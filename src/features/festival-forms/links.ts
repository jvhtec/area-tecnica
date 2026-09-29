export type FormLanguage = "es" | "en";

export const toFormLanguage = (value: unknown): FormLanguage => (value === "en" ? "en" : "es");

/** Public URL of an artist's technical form. */
export const buildArtistFormUrl = (
  token: string,
  language: FormLanguage,
  origin: string = window.location.origin,
): string => `${origin}/festival/artist-form/${token}?lang=${language}`;

/** `festival_artists.stage` is nullable; those artists are grouped explicitly rather than hidden. */
export const formatStageLabel = (stage: number | null): string =>
  stage === null ? "Sin escenario" : `Escenario ${stage}`;

/** Stage numbers in ascending order, with "no stage" last. */
export const sortStages = (stages: Iterable<number | null>): Array<number | null> =>
  [...new Set(stages)].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

export interface ArtistLinkRow {
  artistId: string;
  name: string;
  stage: number | null;
  date?: string | null;
  form_language: FormLanguage;
  token?: string;
  expires_at?: string;
  status?: string;
}

const NO_LINK_YET = "Enlace aún no generado";

const linkLines = (
  artists: readonly ArtistLinkRow[],
  showDate: boolean,
  formatDate: (date?: string | null) => string,
  origin?: string,
): string =>
  artists
    .map((artist) => {
      const link = artist.token ? buildArtistFormUrl(artist.token, artist.form_language, origin) : NO_LINK_YET;
      return `${artist.name}${showDate ? ` (${formatDate(artist.date)})` : ""} - ${link}\n`;
    })
    .join("");

interface LinksTextOptions {
  /** Heading scope, e.g. "Todas las fechas" or a formatted date. */
  scopeLabel: string;
  /** Add each artist's date after their name (when several dates are listed). */
  showDate: boolean;
  formatDate: (date?: string | null) => string;
  origin?: string;
}

/** Text with every artist's link, grouped by stage, ready to paste into a message. */
export function buildAllLinksText(artists: readonly ArtistLinkRow[], options: LinksTextOptions): string {
  const sections = sortStages(artists.map((artist) => artist.stage)).map((stage) => {
    const stageArtists = artists.filter((artist) => artist.stage === stage);
    return `${formatStageLabel(stage)}:\n${linkLines(stageArtists, options.showDate, options.formatDate, options.origin)}\n`;
  });
  return `Enlaces de Formularios de Artistas - ${options.scopeLabel}\n\n${sections.join("")}`;
}

/** Text with the links of a single stage. */
export function buildStageLinksText(
  artists: readonly ArtistLinkRow[],
  stage: number | null,
  options: LinksTextOptions,
): string {
  const stageArtists = artists.filter((artist) => artist.stage === stage);
  return `${formatStageLabel(stage)} - ${options.scopeLabel}\n\n${linkLines(
    stageArtists,
    options.showDate,
    options.formatDate,
    options.origin,
  )}`;
}
