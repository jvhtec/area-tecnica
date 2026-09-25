/**
 * Fields of a logistics event that change the plan a driver confirmed. Mirrors
 * the column list of the `sync_driver_assignments_after_logistics_event_change`
 * trigger (migrations 20260924133000 and 20260925101000): an edit to any of these resets the
 * driver's confirmation server-side, so the driver must be told. Cosmetic edits
 * (colour, departments, Hoja de Ruta flags, carrier, plate) leave the
 * confirmation intact and must not notify.
 */
export const DRIVER_RELEVANT_EVENT_FIELDS = [
  "event_type",
  "transport_type",
  "event_date",
  "event_time",
  "end_date",
  "end_time",
  "timezone",
  "job_id",
  "title",
  "loading_bay",
  "notes",
  "location_id",
  "origin_location_id",
  "passenger_count",
] as const;

type DriverRelevantField = (typeof DRIVER_RELEVANT_EVENT_FIELDS)[number];
export type DriverRelevantEventFields = Partial<Record<DriverRelevantField, string | number | null | undefined>>;

/** Empty strings and missing values are the same "nothing" the database stores as null. */
const normalize = (field: DriverRelevantField, value: string | number | null | undefined): string | null => {
  const trimmed = value === null || value === undefined ? "" : String(value).trim();
  if (!trimmed) return null;
  // `time` columns come back as HH:mm:ss while the form edits HH:mm.
  return field === "event_time" || field === "end_time" ? trimmed.slice(0, 5) : trimmed;
};

/**
 * True when saving `after` over `before` changes something a driver acts on.
 * A field absent from `after` is treated as unchanged (the form does not edit it).
 */
export const isDriverRelevantEventChange = (
  before: DriverRelevantEventFields,
  after: DriverRelevantEventFields,
): boolean =>
  DRIVER_RELEVANT_EVENT_FIELDS.some(
    (field) => field in after && normalize(field, before[field]) !== normalize(field, after[field]),
  );
