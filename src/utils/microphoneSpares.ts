import type { WiredMic } from "@/components/festival/gear-setup/WiredMicConfig";

export interface SpareSuggestionOptions {
  /** Fraction of the peak quantity kept as spares (default 0.1 = 10%). */
  rate?: number;
  /** Minimum spares suggested for any model in use (default 1). */
  minSpare?: number;
  /** Upper bound on spares per model (default no cap). */
  maxSpare?: number;
}

export interface SpareSuggestion {
  model: string;
  peakQuantity: number;
  spareQuantity: number;
}

const DEFAULT_RATE = 0.1;
const DEFAULT_MIN_SPARE = 1;

// Suggests a "worthy" spare count for a single model given its peak concurrent
// need. The rule of thumb on live jobs is roughly one spare per ten units in
// play, but never fewer than one spare for anything actually being used - a
// single fragile capsule failing mid-set with no backup is the case this
// guards against. Callers can tune the rate/floor/cap per festival policy.
export const suggestSpareQuantity = (
  peakQuantity: number,
  options: SpareSuggestionOptions = {},
): number => {
  const { rate = DEFAULT_RATE, minSpare = DEFAULT_MIN_SPARE, maxSpare = Infinity } = options;
  if (!Number.isFinite(peakQuantity) || peakQuantity <= 0) return 0;

  const proportional = Math.ceil(peakQuantity * rate);
  return Math.min(maxSpare, Math.max(minSpare, proportional));
};

export const suggestMicrophoneSpares = (
  requirements: WiredMic[],
  options?: SpareSuggestionOptions,
): SpareSuggestion[] =>
  requirements
    .filter((mic) => mic.model && mic.quantity > 0)
    .map((mic) => ({
      model: mic.model,
      peakQuantity: mic.quantity,
      spareQuantity: suggestSpareQuantity(mic.quantity, options),
    }));

const appendSpareNote = (existing: string | undefined, spare: number): string => {
  const suffix = `+${spare} repuesto${spare === 1 ? "" : "s"}`;
  const trimmed = (existing || "").trim();
  return trimmed ? `${trimmed} · ${suffix}` : suffix;
};

// Folds a per-model spare map back into a requirements list, bumping each
// model's quantity by its chosen spare count and annotating the note so the
// spare portion stays visible after import. Models with no (or zero) spare are
// returned untouched.
export const applyMicrophoneSpares = (
  requirements: WiredMic[],
  spares: Record<string, number>,
): WiredMic[] =>
  requirements.map((mic) => {
    const spare = spares[mic.model] || 0;
    if (spare <= 0) return mic;
    return {
      ...mic,
      quantity: mic.quantity + spare,
      notes: appendSpareNote(mic.notes, spare),
    };
  });
