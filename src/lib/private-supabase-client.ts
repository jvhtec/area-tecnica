import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/api-config";
import { PrivateDataScopeError, type PrivateDataScope } from "@/lib/private-data-scope";

/** Long-running private work must never pick up another account's JWT from
 * the shared client's auth storage between requests. Server RLS still decides
 * access; this client only pins the operation to its original identity. */
export const createPrivateSupabaseClient = async (scope: PrivateDataScope) => {
  scope.assertCurrent();
  const { data, error } = await supabase.auth.getSession();
  scope.assertCurrent();
  if (error) throw error;
  if (!data.session?.access_token || data.session.user.id !== scope.userId) {
    throw new PrivateDataScopeError();
  }
  const accessToken = data.session.access_token;
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    accessToken: async () => accessToken,
    db: { retry: false },
    global: {
      fetch: async (input, init) => {
        scope.assertCurrent();
        const controller = new AbortController();
        const signals = [scope.signal, init?.signal, input instanceof Request ? input.signal : null];
        const abort = () => controller.abort();
        for (const signal of signals) {
          if (signal?.aborted) abort();
          else signal?.addEventListener("abort", abort, { once: true });
        }
        try {
          const response = await fetch(input, { ...init, signal: controller.signal });
          scope.assertCurrent();
          return response;
        } finally {
          signals.forEach((signal) => signal?.removeEventListener("abort", abort));
        }
      },
    },
  });
};

export type PrivateSupabaseClient = Awaited<ReturnType<typeof createPrivateSupabaseClient>>;
