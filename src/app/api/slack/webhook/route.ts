import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getGmailService, findThreadForProspect, getLastMessageDetails, sendEmail } from '@/lib/gmail';

// Helper to parse dates in various formats, particularly DD/MM/YYYY HH:mm
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Try standard parsing first (e.g. YYYY-MM-DD)
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  // Handle Latin format: DD/MM/YYYY HH:mm[:ss]
  const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dmyMatch) {
    const [_, day, month, year, hour, minute, second = '00'] = dmyMatch;
    // pad single digits
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    const paddedHour = hour.padStart(2, '0');
    const paddedMinute = minute.padStart(2, '0');
    const paddedSecond = second.padStart(2, '0');

    const isoStr = `${year}-${paddedMonth}-${paddedDay}T${paddedHour}:${paddedMinute}:${paddedSecond}`;
    const date = new Date(isoStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Fallback to current date
  console.warn(`Unable to parse date string: "${dateStr}". Falling back to current date/time.`);
  return new Date().toISOString();
}

// Extract fields using Regex from payload text
function extractFields(text: string) {
  // Strip out asterisks (Slack markdown bold) for easier regex matching
  const cleanText = text.replace(/\*/g, '');

  const getField = (regex: RegExp) => {
    const match = cleanText.match(regex);
    return match ? match[1].trim() : '';
  };

  const remitente = getField(/Remitente:\s*([^\n]+)/i);
  const empresa = getField(/Empresa:\s*([^\n]+)/i);
  const contacto = getField(/Contacto:\s*([^\n]+)/i);
  const correo = getField(/(?:Correo|Email):\s*([^\n\s]+)/i);
  const telefono = getField(/(?:Teléfono|Telefono):\s*([^\n]+)/i);
  const diaHora = getField(/(?:Día\/Hora|Dia\/Hora|Fecha\/Hora):\s*([^\n]+)/i);
  const sdr = getField(/SDR:\s*([^\n]+)/i);
  const linkMeet = getField(/(?:Link de Meet|Meet|Link):\s*([^\n]+)/i);

  // Determine canal
  let canal = getField(/Canal:\s*(llamada|mail)/i).toLowerCase();
  if (!canal) {
    if (/llamada/i.test(cleanText)) {
      canal = 'llamada';
    } else if (/mail|correo|hilo/i.test(cleanText)) {
      canal = 'mail';
    } else {
      canal = 'llamada'; // default
    }
  }

  return { remitente, empresa, contacto, correo, telefono, diaHora, sdr, linkMeet, canal };
}

export async function POST(request: NextRequest) {
  let text = '';
  
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      
      // Slack URL verification challenge
      if (body.challenge) {
        return NextResponse.json({ challenge: body.challenge });
      }
      
      text = body.text || (body.event && body.event.text) || '';
    } else {
      // Urlencoded form payload (Slash Commands/Outgoing Webhooks)
      const formData = await request.formData();
      text = (formData.get('text') as string) || '';
    }
  } catch (err) {
    console.error('Error parsing Slack request payload:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: 'Empty text parameter' }, { status: 400 });
  }

  console.log('Parsing Slack text:', text);
  const fields = extractFields(text);
  console.log('Extracted fields:', fields);

  const { remitente, empresa, contacto, correo, telefono, diaHora, sdr, linkMeet, canal } = fields;

  if (!remitente || !contacto || !correo || !empresa) {
    return NextResponse.json({
      error: 'Missing required fields in payload (Remitente, Contacto, Correo, Empresa are required)',
      extracted: fields
    }, { status: 400 });
  }

  try {
    // 1. Get Gmail Service for the sender (Remitente)
    const gmail = await getGmailService(remitente);

    let finalThreadId: string | null = null;
    let emailSubject = `Reunión agendada: ${empresa} - ${contacto}`;
    let messageIdToReplyTo: string | undefined;
    let references: string | undefined;

    // 2. Draft the HTML body
    const emailBody = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
        <p>Hola <strong>${contacto}</strong>,</p>
        <p>Tal como conversaste con <strong>${sdr || 'nuestro SDR'}</strong>, la reunión quedó agendada para el día <strong>${diaHora}</strong>.</p>
        <p>A continuación los detalles de la reunión:</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 15px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f9f9f9; width: 30%;">Empresa:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${empresa}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f9f9f9;">SDR Asignado:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${sdr}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f9f9f9;">Link de Meet:</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><a href="${linkMeet}" style="color: #1a73e8; text-decoration: none;">${linkMeet}</a></td>
          </tr>
        </table>
        <p>El enlace de acceso ya está disponible arriba. Quedamos a tu entera disposición ante cualquier consulta.</p>
        <p>¡Que tengas un excelente día!</p>
        <p>Saludos cordiales,<br><strong>${sdr}</strong></p>
      </div>
    `;

    // 3. Send email checking canal (llamada vs. mail)
    if (canal === 'mail') {
      console.log(`Searching thread for prospect: ${correo} in ${remitente}'s inbox...`);
      const threadId = await findThreadForProspect(gmail, correo);
      
      if (threadId) {
        console.log(`Found active thread ${threadId}. Attempting to reply...`);
        const lastMsgDetails = await getLastMessageDetails(gmail, threadId);
        
        if (lastMsgDetails) {
          finalThreadId = threadId;
          messageIdToReplyTo = lastMsgDetails.messageId;
          references = lastMsgDetails.references;
          
          // Re-use thread subject
          const oldSubject = lastMsgDetails.subject;
          emailSubject = oldSubject.toLowerCase().startsWith('re:') ? oldSubject : `Re: ${oldSubject}`;
        }
      } else {
        console.log('No active thread found for prospect. Falling back to creating a new thread.');
      }
    }

    console.log(`Sending email to ${correo}...`);
    const sentMsg = await sendEmail(gmail, {
      to: correo,
      from: remitente,
      subject: emailSubject,
      body: emailBody,
      threadId: finalThreadId || undefined,
      messageIdToReplyTo,
      references
    });

    const gmailThreadId = sentMsg.threadId || finalThreadId || null;
    console.log(`Email sent. Thread ID: ${gmailThreadId}`);

    // 4. Save to Supabase meetings
    const { error: dbError } = await supabaseAdmin
      .from('reuniones')
      .insert({
        cliente_email: remitente,
        empresa,
        nombre_contacto: contacto,
        email: correo,
        telefono,
        fecha_hora: parseDate(diaHora),
        sdr_asignado: sdr,
        link_meet: linkMeet,
        canal,
        gmail_thread_id: gmailThreadId
      });

    if (dbError) {
      console.error('Error inserting meeting in Supabase:', dbError);
      return NextResponse.json({
        success: true,
        gmail_thread_id: gmailThreadId,
        warning: 'Saved in Gmail but failed to record in Supabase: ' + dbError.message
      });
    }

    return NextResponse.json({
      success: true,
      gmail_thread_id: gmailThreadId,
      message: 'Email sent successfully and recorded in Supabase.'
    });

  } catch (err: any) {
    console.error('Slack Webhook Execution Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error during email dispatch' }, { status: 500 });
  }
}
