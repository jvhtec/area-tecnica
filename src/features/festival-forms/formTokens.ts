import { dataLayerClient } from "@/services/dataLayerClient";

export interface ArtistFormTokenForSend {
  created: boolean;
  expiresAt: string;
  formId: string;
  token: string;
}

/**
 * Resolve the active token for an explicit form-send action. The database RPC
 * owns expiry cleanup, concurrency and creation so UI callers cannot leave
 * duplicate pending forms behind.
 */
export async function getOrCreateArtistFormTokenForSend(
  artistId: string,
): Promise<ArtistFormTokenForSend> {
  const { data, error } = await dataLayerClient.rpc(
    "get_or_create_festival_artist_form_for_send",
    { p_artist_id: artistId },
  );

  if (error) throw error;

  const row = data?.[0];
  if (!row?.form_id || !row.token || !row.expires_at) {
    throw new Error("The form send action did not return a valid token");
  }

  return {
    created: row.created,
    expiresAt: row.expires_at,
    formId: row.form_id,
    token: row.token,
  };
}
