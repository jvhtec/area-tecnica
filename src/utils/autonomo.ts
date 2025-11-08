export const NO_AUTONOMO_LABEL = 'No autónomo – €30 descuento';

export const isAutonomo = (value?: boolean | null): boolean => value !== false;

export const getAutonomoBadgeLabel = (value?: boolean | null): string | null =>
  isAutonomo(value) ? null : NO_AUTONOMO_LABEL;

export const appendAutonomoLabel = (
  base: string,
  value?: boolean | null,
  options?: { multiline?: boolean }
): string => {
  if (isAutonomo(value)) return base;
  const label = NO_AUTONOMO_LABEL;
  if (options?.multiline === false) {
    return `${base} (${label})`;
  }
  // Default to multiline to align with PDF tables where additional lines are clearer.
  return `${base}\n${label}`;
};
