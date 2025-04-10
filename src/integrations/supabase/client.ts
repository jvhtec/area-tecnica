
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/api-config';
import type { Database } from './types';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
