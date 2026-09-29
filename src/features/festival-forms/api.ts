import { dataLayerClient } from "@/services/dataLayerClient";
import type { ArtistLinkRow } from "./links";
import { toFormLanguage, type FormLanguage } from "./links";

export interface PendingArtistForm {
  token: string;
  expiresAt: string | null;
}

/** The artist's active (pending, unexpired) public form, if one was already sent. */
export async function fetchPendingArtistForm(artistId: string): Promise<PendingArtistForm | null> {
  const { data, error } = await dataLayerClient
    .from("festival_artist_forms")
    .select("token, expires_at")
    .eq("artist_id", artistId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.token ? { token: data.token, expiresAt: data.expires_at } : null;
}

export async function fetchArtistFormLanguage(artistId: string): Promise<FormLanguage> {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("form_language")
    .eq("id", artistId)
    .maybeSingle();
  if (error) throw error;
  return toFormLanguage(data?.form_language);
}

export async function saveArtistFormLanguage(artistId: string, language: FormLanguage) {
  const { error } = await dataLayerClient
    .from("festival_artists")
    .update({ form_language: language })
    .eq("id", artistId);
  if (error) throw error;
}

/** The artist row the blank-template PDF is pre-filled from. */
export async function fetchArtistForTemplate(artistId: string) {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("*")
    .eq("id", artistId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Every dated artist of the job with the active form link they were sent, if any. */
export async function fetchArtistFormLinks(jobId: string): Promise<ArtistLinkRow[]> {
  const { data: artists, error } = await dataLayerClient
    .from("festival_artists")
    .select("id, name, stage, date, form_language")
    .eq("job_id", jobId)
    .not("date", "is", null)
    .order("date")
    .order("stage")
    .order("show_start");
  if (error) throw error;
  if (!artists || artists.length === 0) return [];

  const { data: forms, error: formsError } = await dataLayerClient
    .from("festival_artist_forms")
    .select("artist_id, token, expires_at, status, updated_at, created_at")
    .in(
      "artist_id",
      artists.map((artist) => artist.id),
    )
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });
  if (formsError) throw formsError;

  // Newest first, so the first form seen for an artist is the one to show.
  const formByArtistId = new Map<string, NonNullable<typeof forms>[number]>();
  for (const form of forms ?? []) {
    if (form.artist_id && !formByArtistId.has(form.artist_id)) formByArtistId.set(form.artist_id, form);
  }

  return artists.map((artist) => {
    const form = formByArtistId.get(artist.id);
    return {
      artistId: artist.id,
      name: artist.name,
      stage: artist.stage,
      date: artist.date,
      form_language: toFormLanguage(artist.form_language),
      token: form?.token ?? undefined,
      expires_at: form?.expires_at ?? undefined,
      status: form?.status ?? undefined,
    };
  });
}

export interface CorporateEmailRequest {
  subject: string;
  bodyHtml: string;
  recipients: string[];
  inlineImages: Array<{ cid: string; content: string; mimeType: string; filename: string }>;
  pdfAttachments: Array<{ filename: string; content: string; size: number }>;
}

/** Sends a corporate email through the `send-corporate-email` edge function. */
export async function sendCorporateEmail(request: CorporateEmailRequest) {
  const { data, error } = await dataLayerClient.functions.invoke("send-corporate-email", {
    body: {
      subject: request.subject,
      bodyHtml: request.bodyHtml,
      recipients: { emails: request.recipients },
      inlineImages: request.inlineImages,
      pdfAttachments: request.pdfAttachments,
      senderNameOverride: "Festivales - Sector Pro",
    },
  });
  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || "No se pudo enviar el correo");
  }
}
