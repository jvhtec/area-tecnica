export type TechnicalStage = {
  number: number;
  name: string;
};

const NO_STAGE_KEY = "__no_stage__";

const normalizePathSegment = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const getTechnicalStageKey = (stage?: TechnicalStage | null) =>
  stage ? `stage-${stage.number}` : NO_STAGE_KEY;

export const isSameTechnicalStage = (
  stageNumber: number | null | undefined,
  selectedStage?: TechnicalStage | null
) => {
  if (!selectedStage) return true;
  return Number(stageNumber) === selectedStage.number;
};

export const getTechnicalStageStorageScope = (stage?: TechnicalStage | null) => {
  if (!stage) return undefined;
  const nameSlug = normalizePathSegment(stage.name);
  return nameSlug ? `stage-${stage.number}-${nameSlug}` : `stage-${stage.number}`;
};

export const appendTechnicalStageToFilename = (
  fileName: string,
  stage?: TechnicalStage | null
) => {
  if (!stage) return fileName;

  const extensionMatch = fileName.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] || "";
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;

  return `${baseName} - ${stage.name}${extension}`;
};

export const formatTechnicalStageLabel = (stage?: TechnicalStage | null) =>
  stage ? stage.name || `Stage ${stage.number}` : "";
