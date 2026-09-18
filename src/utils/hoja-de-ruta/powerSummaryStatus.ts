/**
 * The Hoja de Ruta power summary is a free-text field: it is seeded from the
 * Consumos calculator but, once saved, the saved value always wins on reload so
 * manual edits survive. That means later calculator changes never reach the
 * Hoja on their own, and nothing used to say so.
 */
export type HojaPowerSummaryStatus =
  /** Nothing saved and nothing to offer, or the saved text already matches. */
  | "up-to-date"
  /** The calculator has a summary and the Hoja field is empty. */
  | "missing"
  /** Both exist and differ — the saved text is a manual edit, an older export, or both. */
  | "stale";

const normalize = (value?: string | null) => (value ?? "").trim();

export const getHojaPowerSummaryStatus = ({
  generated,
  saved,
}: {
  generated?: string | null;
  saved?: string | null;
}): HojaPowerSummaryStatus => {
  const generatedText = normalize(generated);
  if (!generatedText) return "up-to-date";

  const savedText = normalize(saved);
  if (!savedText) return "missing";

  return generatedText === savedText ? "up-to-date" : "stale";
};
