import { useCallback, useEffect, useState } from "react";

import { dataLayerClient } from "@/services/dataLayerClient";
import { getErrorMessage } from "@/utils/errorMessage";

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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await dataLayerClient.rpc("get_my_calendar_ics_token");
      if (cancelled) return;
      if (error) {
        console.error("Error fetching calendar token:", getErrorMessage(error));
      } else {
        setToken((data as string | null) ?? "");
      }
      setLoading(false);
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
    setToken(newToken);
    return newToken;
  }, []);

  return { token, loading, rotate };
}
