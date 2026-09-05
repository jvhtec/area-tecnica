import { type PrivateDataScope } from "@/lib/private-data-scope";
import { createPrivateSupabaseClient, type PrivateSupabaseClient } from "@/lib/private-supabase-client";
import { isAuthorizationFailure, revokeFestivalCache } from "./offline-revocation";

/** Mirrors the festival SELECT policy using fresh server state. An empty
 * artist result alone cannot distinguish an empty date from RLS filtering.
 * Never infer permission from the cached profile or the globally visible job.
 */
export const assertFestivalAccess = async (
  jobId: string,
  scope: PrivateDataScope,
  client?: PrivateSupabaseClient,
): Promise<void> => {
  try {
    const supabase = client ?? await createPrivateSupabaseClient(scope);
    scope.assertCurrent();
    const { data: role, error: roleError } = await supabase.rpc("get_current_user_role");
    scope.assertCurrent();
    if (roleError) throw roleError;
    if (["admin", "management", "logistics", "house_tech"].includes(role)) return;
    if (role === "technician") {
      const { data, error } = await supabase.from("job_assignments")
        .select("job_id").eq("job_id", jobId).eq("technician_id", scope.userId).limit(1);
      scope.assertCurrent();
      if (error) throw error;
      if (data?.length) return;
    }
    throw Object.assign(new Error("Ya no tienes acceso a este festival."), { code: "42501" });
  } catch (error) {
    if (isAuthorizationFailure(error)) await revokeFestivalCache(jobId, scope);
    throw error;
  }
};
