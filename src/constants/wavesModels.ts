export type WavesModel = 'server_one' | 'extreme' | 'titan' | 'livebox' | 'fourier' | 'axis_one' | 'axis_scope';

export interface WavesModelSelection {
  model: WavesModel;
  quantity: number;
}

export const WAVES_MODEL_OPTIONS: Array<{ value: WavesModel; label: string }> = [
  { value: 'server_one', label: 'Server One' },
  { value: 'extreme', label: 'Extreme' },
  { value: 'titan', label: 'Titan' },
  { value: 'livebox', label: 'Livebox' },
  { value: 'fourier', label: 'Fourier' },
  { value: 'axis_one', label: 'Axis One' },
  { value: 'axis_scope', label: 'Axis Scope' },
];

export const WAVES_MODEL_LABELS: Record<WavesModel, string> = WAVES_MODEL_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {} as Record<WavesModel, string>
);

export const isWavesModel = (value: unknown): value is WavesModel =>
  typeof value === "string" && WAVES_MODEL_OPTIONS.some((option) => option.value === value);

// Parses raw JSON from the DB (array of {model, quantity} objects, or the
// legacy array-of-strings shape) into a normalized selection list: invalid
// models dropped, quantities coerced to positive integers, duplicate models
// merged.
export const normalizeWavesModelSelections = (value: unknown): WavesModelSelection[] => {
  if (!Array.isArray(value)) return [];

  const totals = new Map<WavesModel, number>();

  value.forEach((entry) => {
    let model: unknown;
    let quantity: unknown = 1;

    if (typeof entry === "string") {
      model = entry;
    } else if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      model = record.model;
      quantity = record.quantity ?? 1;
    }

    if (!isWavesModel(model)) return;

    const parsedQuantity = Math.max(0, Math.floor(Number(quantity)) || 0);
    if (parsedQuantity <= 0) return;

    totals.set(model, (totals.get(model) || 0) + parsedQuantity);
  });

  return Array.from(totals.entries()).map(([model, quantity]) => ({ model, quantity }));
};

export const getWavesModelQuantity = (selections: WavesModelSelection[] | null | undefined, model: WavesModel): number =>
  selections?.find((selection) => selection.model === model)?.quantity || 0;

export const formatWavesModelSelections = (selections: WavesModelSelection[] | null | undefined): string => {
  if (!selections || selections.length === 0) return "";
  return selections
    .map(({ model, quantity }) => {
      const label = WAVES_MODEL_LABELS[model] || model;
      return quantity > 1 ? `${label} ×${quantity}` : label;
    })
    .join(", ");
};

// Combines the selected waves model(s) with free-text outboard notes into a
// single human-readable string, for display surfaces (PDFs, print views,
// table cells) that only render one "Waves/Outboard" line. Accepts raw/loosely
// typed data (e.g. straight off a Supabase row) and normalizes it internally.
export const combineWavesDisplay = (
  selections: unknown,
  outboard: string | null | undefined
): string => {
  const parts = [formatWavesModelSelections(normalizeWavesModelSelections(selections)), (outboard || "").trim()].filter(Boolean);
  return parts.join(" + ");
};

// Server One, Extreme and Titan are all Waves SoundGrid servers, but they
// differ in processing power (Titan > Extreme > Server One): a more powerful
// unit can cover a requirement written for a less powerful one, but not the
// reverse. Axis One and Axis Scope are freely interchangeable with each
// other (no hierarchy). Livebox and Fourier are separate, self-contained
// processing platforms that aren't substitutable by anything else.
export const WAVES_POWER_RANK: Partial<Record<WavesModel, number>> = {
  server_one: 1,
  extreme: 2,
  titan: 3,
};

const WAVES_SYMMETRIC_GROUPS: WavesModel[][] = [
  ['axis_one', 'axis_scope'],
];

// Returns whether `available` can stand in for `required`. Not symmetric:
// canSubstituteWavesModel('server_one', 'titan') is true (a Titan covers a
// Server One requirement) but canSubstituteWavesModel('titan', 'server_one')
// is false (a Server One can't cover a Titan requirement).
export const canSubstituteWavesModel = (required: WavesModel, available: WavesModel): boolean => {
  if (required === available) return true;

  const requiredRank = WAVES_POWER_RANK[required];
  const availableRank = WAVES_POWER_RANK[available];
  if (requiredRank !== undefined && availableRank !== undefined) {
    return availableRank >= requiredRank;
  }

  return WAVES_SYMMETRIC_GROUPS.some((group) => group.includes(required) && group.includes(available));
};
