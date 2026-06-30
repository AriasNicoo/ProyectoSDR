import { createClient } from '@supabase/supabase-js';

// Fallbacks to avoid Next.js build-time crashes if environment variables are not set in Vercel yet
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-id.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL is not set. Using placeholder.');
}

// Client for general client/anon actions (subject to RLS policies)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for backend tasks, cron jobs, and bypass RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
