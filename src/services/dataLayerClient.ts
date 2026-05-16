import { supabase } from "@/lib/supabase";

/**
 * Shared data-layer client for legacy component/page code that still owns query
 * details. New code should prefer domain hooks or service functions, but this
 * boundary removes direct Supabase client ownership from UI modules while Phase
 * 2 migration continues across the largest surfaces.
 */
export const dataLayerClient: typeof supabase = supabase;
