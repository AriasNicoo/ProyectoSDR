import { google } from 'googleapis';
import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/dashboard?auth_status=error&message=' + encodeURIComponent(error), request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?auth_status=error&message=No+code+received', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/dashboard?auth_status=error&message=Missing+Google+OAuth+credentials+on+server', request.url));
  }

  // Dynamically determine the redirect URI based on the request host
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange the code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get the user's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoResponse = await oauth2.userinfo.get();
    const email = userInfoResponse.data.email;

    if (!email) {
      throw new Error('Failed to retrieve user email from Google account info.');
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiryDate = tokens.expiry_date; // unix timestamp in ms

    if (!accessToken || !expiryDate) {
      throw new Error('Missing access token or token expiry information.');
    }

    // Since prompt=consent is used, we should always get a refresh_token.
    // However, if for some reason Google does not send it (e.g. user already consented and we didn't force consent), 
    // we should make sure we preserve the existing refresh_token in Supabase if we already had one.
    
    // First, check if token entry exists
    const { data: existingToken, error: selectError } = await supabaseAdmin
      .from('oauth_tokens')
      .select('refresh_token')
      .eq('email', email)
      .single();

    const finalRefreshToken = refreshToken || (existingToken ? existingToken.refresh_token : null);

    if (!finalRefreshToken) {
      throw new Error('Could not obtain a refresh token. Please remove the app permission in your Google account and try again.');
    }

    // Upsert the oauth token in Supabase
    const { error: upsertError } = await supabaseAdmin
      .from('oauth_tokens')
      .upsert({
        email,
        access_token: accessToken,
        refresh_token: finalRefreshToken,
        token_type: tokens.token_type || 'Bearer',
        expiry_date: expiryDate,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' });

    if (upsertError) {
      console.error('Error inserting token into Supabase:', upsertError);
      throw new Error('Failed to save tokens to database: ' + upsertError.message);
    }

    return NextResponse.redirect(new URL('/dashboard?auth_status=success&connected_email=' + encodeURIComponent(email), request.url));

  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    return NextResponse.redirect(new URL('/dashboard?auth_status=error&message=' + encodeURIComponent(err.message || 'Unknown error'), request.url));
  }
}
