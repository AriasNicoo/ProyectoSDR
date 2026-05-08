import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function addSlackReaction(channelId: string, timestamp: string, emoji: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch('https://slack.com/api/reactions.add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel: channelId, name: emoji, timestamp: timestamp })
    });
  } catch (error) {
    console.error("Error añadiendo reacción en Slack:", error);
  }
}

async function sendSlackConfirmation(channelId: string, text: string, threadTs?: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel: channelId, text: text, thread_ts: threadTs })
    });
  } catch (error) {
    console.error("Error enviando mensaje a Slack:", error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.type === 'url_verification') {
      return new Response(body.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    if (body.type === 'event_callback') {
      const event = body.event;

      // 1. Trigger
      if (event.type === 'message' && !event.bot_id && event.text && event.text.includes('SDR: Nicolas Arias')) {
        const texto = event.text;

        // 2. Emoji Feedback
        await addSlackReaction(event.channel, event.ts, 'rocket');

        // 3. Parser adaptativo para formato full (basado en imagen e instrucciones)
        const extract = (regex: RegExp) => {
          const match = texto.match(regex);
          return match ? match[1].trim() : null;
        };

        // El título suele ser la primera línea sin "clave: valor"
        const lineas = texto.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        const titulo = (lineas.length > 0 && !lineas[0].includes(':')) ? lineas[0] : 'Reunión Agendada';

        const emailOrigen = extract(/Desde qu[eé] mail sali[oó] la reuni[oó]n:\s*(.+)/i);
        const empresa = extract(/Empresa:\s*(.+)/i);
        const nombre = extract(/Nombre Contacto:\s*(.+)/i) || 'Prospecto Sin Nombre';
        const correosContacto = extract(/Correos Contacto:\s*(.+)/i);
        const cargo = extract(/Cargo:\s*(.+)/i);
        let telefono = extract(/Tel[eé]fono:\s*(.+)/i);
        const diaHoraStr = extract(/D[ií]a y Hora:\s*(.+)/i) || '';
        const agendadoPara = extract(/Agendado para:\s*(.+)/i);
        const canal = extract(/Canal:\s*(.+)/i);
        const sdrName = extract(/SDR:\s*(.+)/i) || 'Nicolas Arias';
        
        // Contexto, por si viene en algún momento
        const contextoMatch = texto.match(/Contexto Reunion:\s*([\s\S]+?)(?=\nSDR:|\n$|$)/i);
        const contexto = contextoMatch ? contextoMatch[1].trim() : null;

        // Limpieza Teléfono (Si es N/A se guarda vacío)
        if (telefono && telefono.toUpperCase() === 'N/A') {
          telefono = '';
        } else if (telefono) {
          telefono = telefono.replace(/\D/g, ''); 
          if (telefono.length === 8) telefono = '569' + telefono;
          else if (telefono.length === 9 && telefono.startsWith('9')) telefono = '56' + telefono;
          else if (!telefono.startsWith('56') && telefono.length > 0) telefono = '56' + telefono;
        } else {
          telefono = '';
        }

        // Extracción Date y Time
        let fecha = '';
        let hora = '10:00:00';
        
        const dateParts = diaHoraStr.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2}(:\d{2})?)/);
        if (dateParts) {
          fecha = dateParts[1];
          hora = dateParts[2];
          if (hora.length === 5) hora += ':00'; 
        } else {
          const partes = diaHoraStr.split(/\s+/);
          if (partes.length >= 2) {
            fecha = partes[0];
            hora = partes[1].substring(0, 5) + ':00';
          } else if (partes.length === 1) {
            fecha = partes[0];
          }
        }

        if (fecha.includes('/')) {
          const [dia, mes, anio] = fecha.split('/');
          fecha = `${anio}-${mes}-${dia}`;
        } else if (!fecha) {
          fecha = new Date().toISOString().split('T')[0];
        }

        // 4. Inserción a Supabase con todos los campos nuevos
        const { error } = await supabase.from('reuniones').insert([{
          titulo_reunion: titulo,
          email_origen: emailOrigen,
          empresa: empresa,
          nombre_prospecto: nombre,
          correos_contacto: correosContacto,
          cargo: cargo,
          telefono: telefono,
          fecha_reunion: fecha,
          hora_reunion: hora,
          agendado_para: agendadoPara,
          canal: canal,
          notas: contexto,
          sdr_name: sdrName,
          
          estado_post_llamada: 'pendiente',
          estado_24h: 'pendiente',
          estado_1h: 'pendiente'
        }]);

        if (error) {
          console.error('Error insertando en Supabase:', error);
          await sendSlackConfirmation(
            event.channel, 
            `❌ Error al guardar a ${nombre} de ${empresa || 'Empresa'}. Error: ${error.message}`, 
            event.ts
          );
        } else {
          console.log(`✅ Reunión creada para: ${nombre}`);
          await sendSlackConfirmation(
            event.channel, 
            `✅ ¡Listo! La reunión con ${nombre} ya está en el Dashboard.`,
            event.ts
          );
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error("Error crítico en el Webhook:", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 200 });
  }
}
