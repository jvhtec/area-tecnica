export const NO_AUTONOMO_LABEL = 'No autónomo – €30 descuento';
export const HOUSE_TECH_LABEL = 'Plantilla';

/**
 * Determines if a technician is autonomo (freelancer).
 * Note: House techs are permanent employees but don't get the €30 deduction.
 */
export const isAutonomo = (value?: boolean | null): boolean => value !== false;

/**
 * Gets the appropriate badge label for a technician:
 * - House techs: "Plantilla" (permanent employee, no deduction)
 * - Non-autonomo: "No autónomo – €30 descuento" (contracted, with deduction)
 * - Autonomo: null (freelancer, no label needed)
 */
export const getAutonomoBadgeLabel = (value?: boolean | null, isHouseTech?: boolean | null): string | null => {
  if (isHouseTech === true) return HOUSE_TECH_LABEL;
  return isAutonomo(value) ? null : NO_AUTONOMO_LABEL;
};

export const appendAutonomoLabel = (
  base: string,
  value?: boolean | null,
  options?: { multiline?: boolean; isHouseTech?: boolean | null }
): string => {
  const label = getAutonomoBadgeLabel(value, options?.isHouseTech);
  if (!label) return base;
  if (options?.multiline === false) {
    return `${base} (${label})`;
  }
  // Default to multiline to align with PDF tables where additional lines are clearer.
  return `${base}\n${label}`;
};
