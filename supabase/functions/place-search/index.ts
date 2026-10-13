import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHttpHandler, requireEnvValues } from '../_shared/http.ts';
import { logEvent } from '../_shared/structuredLogger.ts';
import { createPlaceSearchHandler } from './handler.ts';

Deno.serve(createHttpHandler(async (req) => {
  const env = requireEnvValues(
    ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_MAPS_API_KEY'] as const,
    (name) => Deno.env.get(name),
  );
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return createPlaceSearchHandler(supabase, env.GOOGLE_MAPS_API_KEY)(req);
}, {
  internalErrorMessage: 'No se pudo buscar la ubicación',
  onError: () => logEvent('error', 'place_search.request_failed'),
}));
