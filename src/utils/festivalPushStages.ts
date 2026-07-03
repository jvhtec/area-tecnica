export const normalizeFestivalStages = (stages: number[]) =>
  Array.from(new Set(stages.filter((stage) => Number.isInteger(stage) && stage > 0)))
    .sort((left, right) => left - right);
