import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://caqmdktqxusfmkucdcpe.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhcW1ka3RxeHVzZm1rdWNkY3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MzIzODQsImV4cCI6MjA4OTAwODM4NH0.h5uPwHuu6Aw1mjGd3YcvMB923YF93tvw_dgklROaA8k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
