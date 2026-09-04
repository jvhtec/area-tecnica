import { useCallback, useEffect, useRef, useState } from "react";

import { dataLayerClient } from "@/services/dataLayerClient";
import { getErrorMessage } from "@/utils/errorMessage";

type SupabaseLikeError = { code?: string | null; message?: string | null };

function isMissingReadRpc(error: SupabaseLikeError): boolean {
  if (error.code === "42883" || error.code === "PGRST202") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("get_my_calendar_ics_token") &&
    (message.includes("does not exist") || message.includes("schema cache"));
}

async function readLegacyTokenBeforeMigration(): Promise<string | null> {
  const { data: authData, error: authError } = await dataLayerClient.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return null;

  const { data, error } = await dataLayerClient
    .from("profiles")
    .select("calendar_ics_token")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.calendar_ics_token ?? null;
}

/**
 * Owns the technician calendar (ICS) token.
 *
 * The token is a bearer credential for the `tech-calendar-ics` feed, so it
 * deliberately does not live on the `profiles` row — that row is readable by
 * every authenticated user, which would let any colleague lift it (SEC-13).
 * Both reading and rotating therefore go through self-scoped RPCs that key off
 * `auth.uid()` rather than any argument the caller supplies.
 */
export function useCalendarIcsToken() {
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  // Set once a rotation has landed. The initial read is fired on mount and can
  // still be in flight when the user rotates; without this its response would
  // arrive later and overwrite the new token with the one the server has just
  // revoked, leaving a calendar URL that 403s until reload.
  const rotatedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await dataLayerClient.rpc("get_my_calendar_ics_token");
      if (cancelled) return;
      let nextToken = data as string | null;
      if (error && isMissingReadRpc(error)) {
        try {
          nextToken = await readLegacyTokenBeforeMigration();
        } catch (fallbackError) {
          console.error("Error fetching legacy calendar token:", getErrorMessage(fallbackError));
          nextToken = null;
        }
      } else if (error) {
        console.error("Error fetching calendar token:", getErrorMessage(error));
        nextToken = null;
      }
      if (!cancelled && !rotatedRef.current) {
        setToken(nextToken ?? "");
      }
      if (!cancelled) setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Generates a new token, invalidating any existing calendar subscription. */
  const rotate = useCallback(async (): Promise<string> => {
    const { data, error } = await dataLayerClient.rpc("rotate_my_calendar_ics_token");
    if (error) throw error;
    const newToken = data as string;
    rotatedRef.current = true;
    setToken(newToken);
    return newToken;
  }, []);

  return { token, loading, rotate };
}
