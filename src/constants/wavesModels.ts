export type WavesModel = 'server_one' | 'extreme' | 'titan' | 'livebox' | 'fourier' | 'axis_one' | 'axis_scope';

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

export const formatWavesModels = (models: string[] | null | undefined): string => {
  if (!models || models.length === 0) return "";
  return models.map((model) => WAVES_MODEL_LABELS[model as WavesModel] || model).join(", ");
};

// Combines the selected waves model(s) with free-text outboard notes into a
// single human-readable string, for display surfaces (PDFs, print views)
// that only render one "Waves/Outboard" line.
export const combineWavesDisplay = (
  models: string[] | null | undefined,
  outboard: string | null | undefined
): string => {
  const parts = [formatWavesModels(models), (outboard || "").trim()].filter(Boolean);
  return parts.join(" + ");
};

// Compatibility islands: models within the same group can be substituted for
// one another (mismatch = warning). Models in different groups (or with no
// group) cannot be substituted (mismatch = error). Server One, Extreme and
// Titan are all Waves SoundGrid servers and are interoperable with each
// other. Axis One and Axis Scope are interchangeable with each other but not
// with the SoundGrid family. Livebox and Fourier are separate, self-contained
// processing platforms that aren't compatible with any other family or with
// each other.
const WAVES_COMPATIBILITY_GROUPS: WavesModel[][] = [
  ['server_one', 'extreme', 'titan'],
  ['axis_one', 'axis_scope'],
];

export const areWavesModelsCompatible = (a: WavesModel, b: WavesModel): boolean => {
  if (a === b) return true;
  return WAVES_COMPATIBILITY_GROUPS.some((group) => group.includes(a) && group.includes(b));
};
