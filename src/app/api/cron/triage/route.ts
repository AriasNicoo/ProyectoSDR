import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getGmailService } from '@/lib/gmail';

// Helper to get or create label ID by name in Gmail
async function getOrCreateLabelId(gmail: any, labelName: string): Promise<string> {
  const res = await gmail.users.labels.list({ userId: 'me' });
  const labels = res.data.labels || [];
  const match = labels.find((l: any) => l.name.toLowerCase() === labelName.toLowerCase());
  
  if (match) return match.id;

  const createRes = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });
  return createRes.data.id;
}

// Call LLM API (Groq) to evaluate email intention
async function triageReplyWithLLM(replyText: string): Promise<{ intencion_reunion: boolean; resumen: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in environment variables.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente SDR de triaje. Tu tarea es analizar la respuesta de un cliente potencial y determinar si tiene intención o interés en coordinar una reunión/llamada o seguir conversando de manera positiva (intencion_reunion: true) o si rechaza de manera definitiva, dice que no le interesa o pide ser removido (intencion_reunion: false).
          Debes responder obligatoriamente en formato JSON válido con esta estructura:
          {
            "intencion_reunion": boolean,
            "resumen": "resumen corto en español de la respuesta en menos de 20 palabras"
          }`
        },
        {
          role: 'user',
          content: `Respuesta del cliente: "${replyText}"`
        }
      ],
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('LLM response returned empty content');
  }

  // Clean markdown block wrappers if present (sometimes models include ```json ... ``` despite json_object mode)
  const cleaned = rawContent.replace(/```json/i, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function GET(request: NextRequest) {
  // 1. Authorization Check (Vercel Cron Secret)
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch all registered inboxes
    const { data: accounts, error: dbError } = await supabaseAdmin
      .from('oauth_tokens')
      .select('email');

    if (dbError) {
      console.error('Database error fetching accounts:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: 'No accounts registered', processed: 0 });
    }

    const triageResults: any[] = [];

    // 3. Process each inbox
    for (const account of accounts) {
      const email = account.email;
      
      try {
        console.log(`Checking unread replies for inbox: ${email}...`);
        const gmail = await getGmailService(email);

        // Get label IDs for "proceso" and "rechazado" to modify labels later
        const procesoLabelId = await getOrCreateLabelId(gmail, 'proceso');
        const rechazadoLabelId = await getOrCreateLabelId(gmail, 'rechazado');

        // Search for unread threads under label "proceso"
        const searchRes = await gmail.users.threads.list({
          userId: 'me',
          q: `label:proceso is:unread`,
        });

        const threads = searchRes.data.threads || [];
        console.log(`Found ${threads.length} unread threads under label "proceso" in ${email}`);

        for (const thread of threads) {
          const threadId = thread.id;
          if (!threadId) continue;

          try {
            // Retrieve messages in thread to get last message content
            const threadDetails = await gmail.users.threads.get({
              userId: 'me',
              id: threadId,
            });
            const messages = threadDetails.data.messages || [];
            if (messages.length === 0) continue;

            const lastMessage = messages[messages.length - 1];
            
            // Check if the last message was actually from the prospect (and not ourselves)
            const headers = lastMessage.payload?.headers || [];
            const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
            const senderEmail = fromHeader.match(/<([^>]+)>/)?.[1] || fromHeader.trim();

            if (senderEmail.toLowerCase() === email.toLowerCase()) {
              console.log(`Skipping thread ${threadId}: Last message was sent by ourselves (${email}).`);
              continue;
            }

            // Extract content from snippet or body
            const snippet = lastMessage.snippet || '';
            console.log(`Triaging thread ${threadId}. Snippet: "${snippet}"`);

            // 4. Call LLM for Triage
            const triage = await triageReplyWithLLM(snippet);
            console.log(`Triage decision for thread ${threadId}:`, triage);

            // 5. Look up SDR assigned to this thread in Supabase
            const { data: meetingData } = await supabaseAdmin
              .from('reuniones')
              .select('sdr_asignado, nombre_contacto, empresa')
              .eq('gmail_thread_id', threadId)
              .limit(1)
              .maybeSingle();

            const sdrName = meetingData?.sdr_asignado || 'SDR';
            const contactName = meetingData?.nombre_contacto || 'Prospecto';
            const companyName = meetingData?.empresa || 'Empresa';

            // 6. Action based on triage
            if (triage.intencion_reunion) {
              // INTERESTED: Remove label 'proceso', mark as read
              await gmail.users.threads.modify({
                userId: 'me',
                id: threadId,
                requestBody: {
                  removeLabelIds: [procesoLabelId, 'UNREAD'],
                },
              });

              // Send Slack alert tagging SDR with thread link
              const threadLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
              const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
              if (slackWebhookUrl) {
                const alertMessage = `🔥 *¡Nueva Intención de Reunión Detectada!* 🔥\n` +
                  `👤 *SDR Asignado:* @${sdrName}\n` +
                  `🏢 *Cliente/Empresa:* ${contactName} (${companyName})\n` +
                  `📧 *Inbox Origen:* \`${email}\`\n` +
                  `📝 *Resumen del LLM:* _"${triage.resumen}"_\n` +
                  `🔗 *Acceder al Hilo:* <${threadLink}|Abrir en Gmail>`;

                await fetch(slackWebhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: alertMessage }),
                });
              }

              triageResults.push({
                threadId,
                email,
                decision: 'interested',
                summary: triage.resumen,
              });

            } else {
              // NOT INTERESTED (Rejected): Remove label 'proceso', add label 'rechazado', mark as read
              await gmail.users.threads.modify({
                userId: 'me',
                id: threadId,
                requestBody: {
                  addLabelIds: [rechazadoLabelId],
                  removeLabelIds: [procesoLabelId, 'UNREAD'],
                },
              });

              triageResults.push({
                threadId,
                email,
                decision: 'rejected',
                summary: triage.resumen,
              });
            }
          } catch (threadErr: any) {
            console.error(`Error processing thread ${threadId} for triage:`, threadErr);
          }
        }
      } catch (accErr: any) {
        console.error(`Error processing account ${email} for triage:`, accErr);
      }
    }

    return NextResponse.json({
      success: true,
      results: triageResults,
    });

  } catch (globalErr: any) {
    console.error('Global Triage Error:', globalErr);
    return NextResponse.json({ error: globalErr.message || 'Internal Server Error' }, { status: 500 });
  }
}
