import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getGmailService, getLastMessageDetails, sendEmail } from '@/lib/gmail';

export async function GET(request: NextRequest) {
  // 1. Authenticate Request (Vercel Cron Secret check)
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch all registered client inboxes
    const { data: accounts, error: dbError } = await supabaseAdmin
      .from('oauth_tokens')
      .select('email');

    if (dbError) {
      console.error('Error fetching oauth accounts from database:', dbError);
      return NextResponse.json({ error: 'Database error fetching accounts' }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      console.log('No client inboxes registered for pushes.');
      return NextResponse.json({ message: 'No accounts registered', pushes_sent: 0 });
    }

    let totalPushesSent = 0;
    const detailsPerAccount: { email: string; count: number; errors: string[] }[] = [];

    // 3. Process each client inbox
    for (const account of accounts) {
      const email = account.email;
      let accountPushCount = 0;
      const accountErrors: string[] = [];

      try {
        console.log(`Processing pushes for inbox: ${email}...`);
        const gmail = await getGmailService(email);

        // Search threads with "proceso" label
        const threadsRes = await gmail.users.threads.list({
          userId: 'me',
          q: 'label:proceso',
        });

        const threads = threadsRes.data.threads || [];
        console.log(`Found ${threads.length} threads in "proceso" for ${email}`);

        for (const thread of threads) {
          const threadId = thread.id;
          if (!threadId) continue;

          try {
            // Get last message info in thread
            const lastMsgDetails = await getLastMessageDetails(gmail, threadId);

            if (!lastMsgDetails) {
              console.warn(`Could not fetch details for thread ${threadId}`);
              continue;
            }

            // Retrieve the original sender/recipient from headers
            // We want to send the reply to the prospect (not ourselves)
            // Retrieve messages in thread to determine who we're talking to
            const threadDetails = await gmail.users.threads.get({
              userId: 'me',
              id: threadId,
            });
            const messages = threadDetails.data.messages || [];
            
            // Look for prospect email in thread messages. 
            // Typically, the last message from someone else, or the recipient of our first message.
            let prospectEmail = '';
            for (let i = messages.length - 1; i >= 0; i--) {
              const headers = messages[i].payload?.headers || [];
              const fromVal = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
              // Extract raw email address
              const extractedEmail = fromVal.match(/<([^>]+)>/)?.[1] || fromVal.trim();
              if (extractedEmail && extractedEmail.toLowerCase() !== email.toLowerCase()) {
                prospectEmail = extractedEmail;
                break;
              }
            }

            // Fallback to To header of last message if we couldn't find a distinct sender
            if (!prospectEmail) {
              const headers = messages[messages.length - 1].payload?.headers || [];
              const toVal = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
              prospectEmail = toVal.match(/<([^>]+)>/)?.[1] || toVal.trim();
            }

            if (!prospectEmail || prospectEmail.toLowerCase() === email.toLowerCase()) {
              console.warn(`Could not determine prospect email for thread ${threadId}, skipping.`);
              continue;
            }

            const oldSubject = lastMsgDetails.subject;
            const subject = oldSubject.toLowerCase().startsWith('re:') ? oldSubject : `Re: ${oldSubject}`;

            // Craft follow-up HTML body
            const body = `
              <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
                <p>Hola,</p>
                <p>Quería dar un breve seguimiento a mi correo anterior. ¿Tuviste oportunidad de revisarlo?</p>
                <p>Cuéntame si te acomoda que coordinemos una breve llamada de 10 minutos esta semana.</p>
                <p>¡Quedo atento!</p>
                <p>Saludos cordiales,</p>
              </div>
            `;

            console.log(`Sending push to ${prospectEmail} in thread ${threadId}...`);
            await sendEmail(gmail, {
              to: prospectEmail,
              from: email,
              subject,
              body,
              threadId,
              messageIdToReplyTo: lastMsgDetails.messageId,
              references: lastMsgDetails.references,
            });

            accountPushCount++;
            totalPushesSent++;
          } catch (threadErr: any) {
            console.error(`Error processing push for thread ${threadId}:`, threadErr);
            accountErrors.push(`Thread ${threadId}: ${threadErr.message || 'Unknown'}`);
          }
        }
      } catch (accErr: any) {
        console.error(`Error initializing client Gmail for ${email}:`, accErr);
        accountErrors.push(`Initialization: ${accErr.message || 'Unknown'}`);
      }

      detailsPerAccount.push({
        email,
        count: accountPushCount,
        errors: accountErrors,
      });
    }

    // 4. Send Slack notification
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      let slackMessage = `📊 *Reporte de Pushes Bi-semanales*\n`;
      slackMessage += `- total de inboxes procesadas: *${accounts.length}*\n`;
      slackMessage += `- Total de pushes enviados exitosamente: *${totalPushesSent}*\n\n`;
      
      slackMessage += `*Detalle por bandeja:*\n`;
      detailsPerAccount.forEach((item) => {
        slackMessage += `🔹 \`${item.email}\`: *${item.count}* pushes enviados\n`;
        if (item.errors.length > 0) {
          slackMessage += `  ⚠️ Errores (${item.errors.length}): \`${item.errors.slice(0, 3).join(', ')}\`\n`;
        }
      });

      try {
        await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: slackMessage }),
        });
        console.log('Slack notification sent successfully.');
      } catch (slackErr) {
        console.error('Failed to notify Slack:', slackErr);
      }
    }

    return NextResponse.json({
      success: true,
      total_pushes_sent: totalPushesSent,
      details: detailsPerAccount,
    });

  } catch (globalErr: any) {
    console.error('Global Cron Pushes Error:', globalErr);
    return NextResponse.json({ error: globalErr.message || 'Internal Server Error' }, { status: 500 });
  }
}
