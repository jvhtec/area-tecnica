export type CalendarTokenQueryError = {
  code?: string | null;
  message?: string | null;
};

export type CalendarTokenLookupSource = {
  readVaultToken: (profileId: string) => Promise<{
    token: string | null;
    error: CalendarTokenQueryError | null;
  }>;
  readLegacyToken: (profileId: string) => Promise<{
    token: string | null;
    error: CalendarTokenQueryError | null;
  }>;
};

/** PostgREST error returned while the additive vault migration is not applied. */
export function isMissingCalendarTokenVault(error: CalendarTokenQueryError | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("profile_calendar_tokens") &&
    (message.includes("does not exist") || message.includes("schema cache"));
}

/**
 * Reads the vault after migration and falls back to profiles only while the
 * vault relation itself is absent. Other vault failures stay fail-closed.
 */
export async function resolveCalendarToken(
  source: CalendarTokenLookupSource,
  profileId: string,
): Promise<{ token: string | null; error: CalendarTokenQueryError | null }> {
  const vaultResult = await source.readVaultToken(profileId);
  if (!vaultResult.error) return vaultResult;
  if (!isMissingCalendarTokenVault(vaultResult.error)) return vaultResult;
  return source.readLegacyToken(profileId);
}
