import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables. ' +
    'Copy .env.example to .env and fill in your Supabase credentials.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
