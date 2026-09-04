export type TechnicianArtistStageOption = {
  value: string;
  label: string;
  count: number;
};

export const normalizeTechnicianArtistStage = (stage: number | null): number => stage ?? 0;

export const buildTechnicianArtistStageOptions = (
  artists: Array<{ stage: number | null }>,
  stageNames: Record<number, string>,
): TechnicianArtistStageOption[] => {
  const uniqueStages = Array.from(
    new Set(artists.map((artist) => normalizeTechnicianArtistStage(artist.stage))),
  ).sort((left, right) => left - right);

  return uniqueStages.map((stageNumber) => ({
    value: String(stageNumber),
    label: stageNumber === 0 ? "Sin escenario" : stageNames[stageNumber] || `Escenario ${stageNumber}`,
    count: artists.filter(
      (artist) => normalizeTechnicianArtistStage(artist.stage) === stageNumber,
    ).length,
  }));
};
