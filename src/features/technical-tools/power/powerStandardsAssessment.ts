import {
  evaluatePowerStandards,
  type PowerStandardsAssessment,
} from "@/features/technical-tools/power/electricalStandards";
import {
  getPowerPduAmpRating,
  POWER_PDU_PLANNING_LOAD_FACTOR,
} from "@/features/technical-tools/power/powerCalculations";
import type { PowerTable } from "@/features/technical-tools/power/types";

export type PowerStandardsTableInput = Pick<
  PowerTable,
  "calculation" | "customPduType" | "includesHoist" | "pduType" | "rows"
>;

/**
 * Planning current a PDU label is good for, or `null` when the label carries
 * no parseable ampere rating (custom labels are unverified, not safe).
 */
export const getPowerPduPlanningLimit = (pduLabel: string): number | null => {
  const rating = getPowerPduAmpRating(pduLabel);
  return rating === undefined ? null : rating * POWER_PDU_PLANNING_LOAD_FACTOR;
};

/**
 * Runs the Spanish design-rule checks over a generated table. Returns `null`
 * for tables without a reproducible snapshot, since there is nothing solid to
 * check the regulatory floors against.
 */
export const assessPowerTableStandards = (
  table: PowerStandardsTableInput,
): PowerStandardsAssessment | null => {
  const calculation = table.calculation;
  if (!calculation) return null;

  return evaluatePowerStandards({
    calculation,
    includesHoist: Boolean(table.includesHoist),
    pduLimitCurrent: getPowerPduPlanningLimit(
      table.customPduType || table.pduType || "",
    ),
    rows: table.rows ?? [],
  });
};
