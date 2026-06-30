import { google } from 'googleapis';
import { supabaseAdmin } from './supabase';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

/**
 * Gets an authenticated OAuth2 client for a given inbox email.
 * Automatically refreshes the access token if it is expired or about to expire.
 */
export async function getGoogleAuthClient(email: string) {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth credentials not configured in environment variables.');
  }

  // 1. Fetch token from Supabase
  const { data: tokenData, error: dbError } = await supabaseAdmin
    .from('oauth_tokens')
    .select('*')
    .eq('email', email)
    .single();

  if (dbError || !tokenData) {
    throw new Error(`No credentials found for email: ${email}. Please authorize this inbox first.`);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  oauth2Client.setCredentials({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
    expiry_date: Number(tokenData.expiry_date)
  });

  // 2. Check expiration (refresh if it expires in less than 30 seconds)
  const isExpired = Date.now() + 30000 >= Number(tokenData.expiry_date);

  if (isExpired) {
    console.log(`Token for ${email} is expired or expiring soon. Refreshing...`);
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      const newAccessToken = credentials.access_token;
      const newExpiryDate = credentials.expiry_date;

      if (!newAccessToken || !newExpiryDate) {
        throw new Error('Refresh response did not return a new access token.');
      }

      // Update Supabase with new credentials
      const { error: updateError } = await supabaseAdmin
        .from('oauth_tokens')
        .update({
          access_token: newAccessToken,
          expiry_date: newExpiryDate,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateError) {
        console.error('Error updating refreshed tokens in database:', updateError);
      } else {
        console.log(`Token for ${email} refreshed successfully.`);
      }

      oauth2Client.setCredentials(credentials);
    } catch (refreshErr) {
      console.error(`Failed to refresh token for ${email}:`, refreshErr);
      throw new Error(`Failed to refresh Google session for ${email}. Re-authorization might be required.`);
    }
  }

  return oauth2Client;
}

/**
 * Helper to get Gmail service client
 */
export async function getGmailService(email: string) {
  const auth = await getGoogleAuthClient(email);
  return google.gmail({ version: 'v1', auth });
}

/**
 * Builds a Base64URL encoded MIME message string.
 */
export function buildMimeMessage({
  to,
  from,
  subject,
  body,
  threadId,
  messageIdToReplyTo,
  references,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string;
  messageIdToReplyTo?: string;
  references?: string;
}) {
  const headers: string[] = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
  ];

  if (threadId && messageIdToReplyTo) {
    headers.push(`In-Reply-To: ${messageIdToReplyTo}`);
    // References should contain the messageIdToReplyTo plus any existing references
    const refs = references ? `${references} ${messageIdToReplyTo}` : messageIdToReplyTo;
    headers.push(`References: ${refs}`);
  }

  // Join headers and body
  const emailStr = [...headers, '', body].join('\r\n');

  // Convert to Base64URL
  return Buffer.from(emailStr)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Finds the latest active thread involving the prospect email.
 */
export async function findThreadForProspect(gmail: any, prospectEmail: string): Promise<string | null> {
  try {
    const res = await gmail.users.threads.list({
      userId: 'me',
      q: prospectEmail,
      maxResults: 1,
    });
    
    const threads = res.data.threads || [];
    if (threads.length === 0) return null;
    return threads[0].id || null;
  } catch (err) {
    console.error('Error finding thread for prospect:', err);
    return null;
  }
}

/**
 * Retrieves header details of the last message in a thread to construct a reply.
 */
export async function getLastMessageDetails(gmail: any, threadId: string) {
  try {
    const res = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
    });
    
    const messages = res.data.messages || [];
    if (messages.length === 0) return null;
    
    const lastMessage = messages[messages.length - 1];
    const headers = lastMessage.payload?.headers || [];
    
    const messageId = headers.find((h: any) => h.name.toLowerCase() === 'message-id')?.value;
    const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
    const references = headers.find((h: any) => h.name.toLowerCase() === 'references')?.value || '';
    
    return {
      messageId,
      subject,
      references,
    };
  } catch (err) {
    console.error('Error getting last message details:', err);
    return null;
  }
}

/**
 * Sends an email raw via Gmail. Supports replying to existing threads.
 */
export async function sendEmail(
  gmail: any,
  params: {
    to: string;
    from: string;
    subject: string;
    body: string;
    threadId?: string;
    messageIdToReplyTo?: string;
    references?: string;
  }
) {
  const raw = buildMimeMessage(params);
  
  const requestBody: any = { raw };
  if (params.threadId) {
    requestBody.threadId = params.threadId;
  }

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody,
  });

  return res.data;
}

