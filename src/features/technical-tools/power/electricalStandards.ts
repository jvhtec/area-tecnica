import type { PowerCalculationSnapshot } from "@/features/technical-tools/power/types";

/**
 * Structural shape the checks need from a load row. Deliberately not the
 * calculator's own row type, so the PDF exporter can pass its rows unchanged.
 */
export type PowerStandardsRow = {
  quantity?: string;
  watts?: string;
  totalWatts?: number;
  pf?: string;
  fixtureType?: string;
};

/**
 * Nominal low-voltage supply for Spain and the rest of the CENELEC area:
 * 230 V line-to-neutral, 400 V line-to-line, 50 Hz.
 *
 * UNE-EN 60038 (IEC 60038 / CENELEC HD 472 S1); REBT ITC-BT-04. Both values
 * stay editable in the calculator because the supply actually delivered on
 * site is what has to be measured and confirmed.
 */
export const NOMINAL_LINE_TO_NEUTRAL_VOLTAGE = 230;
export const NOMINAL_LINE_TO_LINE_VOLTAGE = 400;
export const NOMINAL_SUPPLY_FREQUENCY_HZ = 50;

/**
 * REBT ITC-BT-44 §3.1 — a circuit feeding discharge lamps is designed for a
 * minimum load, in volt-amperes, of 1,8 times the lamp power in watts. The
 * factor bundles ballast losses, power factor and harmonic content into one
 * number, so it is a floor on the *circuit* rating, not a statement about the
 * fixture's measured draw.
 */
export const ITC_BT_44_DISCHARGE_VA_FACTOR = 1.8;

/**
 * REBT ITC-BT-47 §3.1 — conductors feeding a single motor are sized for 125 %
 * of its full-load current. Hoist supplies are recorded as a connector
 * requirement only, so this factor is surfaced as a reminder rather than
 * applied to any total.
 */
export const ITC_BT_47_MOTOR_CURRENT_FACTOR = 1.25;

/**
 * UNE-HD 60364-5-52 Annex E (REBT ITC-BT-19) — past roughly a third of
 * third-harmonic content the neutral of a three-phase circuit can carry more
 * current than the lines and becomes the conductor that sets the cable size.
 */
export const TRIPLEN_HARMONIC_NEUTRAL_THRESHOLD = 0.33;

/** Fixture families whose input stage is a rectifier, i.e. non-linear loads. */
const NON_LINEAR_FIXTURE_TYPES = new Set([
  "discharge",
  "led",
  "led-pro",
  "smoke",
  "consoles",
]);

const DISCHARGE_FIXTURE_TYPE = "discharge";

/** Relative tolerance before a regulatory floor counts as exceeded. */
const REGULATORY_FLOOR_TOLERANCE = 1.001;

export type PowerStandardsFindingCode =
  | "itc-bt-44-discharge"
  | "itc-bt-19-neutral-harmonics"
  | "itc-bt-47-motor-feed";

export type PowerStandardsFinding = {
  code: PowerStandardsFindingCode;
  /** Clause the finding comes from, shown verbatim next to the message. */
  reference: string;
  message: string;
  severity: "warning" | "info";
};

export type PowerStandardsAssessment = {
  /** Connected watts declared as discharge sources. */
  dischargeWatts: number;
  /**
   * Share of the typed load that is non-linear, or `null` when no row
   * declares a fixture type (sound and video tables do not).
   */
  nonLinearWattsShare: number | null;
  /** ITC-BT-44 design floor for the whole table, after the planning margin. */
  regulatoryMinimumVa: number | null;
  /** Line current implied by `regulatoryMinimumVa`. */
  regulatoryMinimumCurrent: number | null;
  findings: PowerStandardsFinding[];
};

const formatNumber = (value: number, fractionDigits: number) =>
  new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);

const getRowWatts = (row: PowerStandardsRow) => {
  const stored = row.totalWatts;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) return stored;
  const quantity = Number.parseFloat(row.quantity || "0");
  const watts = Number.parseFloat(row.watts || "0");
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (!Number.isFinite(watts) || watts <= 0) return 0;
  return quantity * watts;
};

const getRowPowerFactor = (row: PowerStandardsRow, fallback: number) => {
  const candidate = Number(row.pf);
  return Number.isFinite(candidate) && candidate > 0 && candidate <= 1 ? candidate : fallback;
};

/**
 * Checks a finished calculation against the Spanish design rules that add a
 * requirement the power-triangle result does not carry on its own. It never
 * changes a total: every outcome is an advisory the planner acts on.
 */
export const evaluatePowerStandards = ({
  calculation,
  includesHoist = false,
  pduLimitCurrent = null,
  rows,
}: {
  calculation: PowerCalculationSnapshot;
  includesHoist?: boolean;
  /** Planning current limit of the recommended PDU, when one is known. */
  pduLimitCurrent?: number | null;
  rows: PowerStandardsRow[];
}): PowerStandardsAssessment => {
  const globalPowerFactor = calculation.powerFactor;
  const fallbackPowerFactor =
    typeof globalPowerFactor === "number" &&
    Number.isFinite(globalPowerFactor) &&
    globalPowerFactor > 0 &&
    globalPowerFactor <= 1
      ? globalPowerFactor
      : 1;
  const loadMultiplier = 1 + calculation.safetyMargin / 100;
  const phaseDivisor = calculation.phaseMode === "single" ? 1 : Math.sqrt(3);

  let dischargeWatts = 0;
  let remainingWatts = 0;
  let remainingVar = 0;
  let typedWatts = 0;
  let nonLinearWatts = 0;

  rows.forEach((row) => {
    const watts = getRowWatts(row);
    if (watts <= 0) return;

    const fixtureType = row.fixtureType;
    if (fixtureType) {
      typedWatts += watts;
      if (NON_LINEAR_FIXTURE_TYPES.has(fixtureType)) nonLinearWatts += watts;
    }

    if (fixtureType === DISCHARGE_FIXTURE_TYPE) {
      dischargeWatts += watts;
      return;
    }

    const powerFactor = getRowPowerFactor(row, fallbackPowerFactor);
    remainingWatts += watts;
    if (powerFactor < 1) remainingVar += watts * Math.tan(Math.acos(powerFactor));
  });

  const nonLinearWattsShare = typedWatts > 0 ? nonLinearWatts / typedWatts : null;

  // The discharge floor replaces the PF-derived apparent power of those rows
  // and is added to the remaining rows' vector sum, which is the conservative
  // reading of ITC-BT-44 when the two families share one circuit.
  const regulatoryMinimumVa =
    dischargeWatts > 0
      ? loadMultiplier *
        (ITC_BT_44_DISCHARGE_VA_FACTOR * dischargeWatts +
          Math.hypot(remainingWatts, remainingVar))
      : null;
  const regulatoryMinimumCurrent =
    regulatoryMinimumVa !== null && calculation.voltage > 0
      ? regulatoryMinimumVa / (phaseDivisor * calculation.voltage)
      : null;

  const findings: PowerStandardsFinding[] = [];

  if (
    regulatoryMinimumVa !== null &&
    regulatoryMinimumVa > calculation.totalVa * REGULATORY_FLOOR_TOLERANCE
  ) {
    const overPdu =
      pduLimitCurrent !== null &&
      regulatoryMinimumCurrent !== null &&
      regulatoryMinimumCurrent > pduLimitCurrent;
    findings.push({
      code: "itc-bt-44-discharge",
      reference: "REBT ITC-BT-44 apdo. 3.1",
      // The floor is conservative by construction, so it only escalates to a
      // warning once it would actually change the connector choice.
      severity: overPdu ? "warning" : "info",
      message:
        `Los ${formatNumber(dischargeWatts, 0)} W de lámparas de descarga de esta tabla ` +
        `obligan a prever el circuito para ${formatNumber(regulatoryMinimumVa / 1000, 2)} kVA` +
        (regulatoryMinimumCurrent === null
          ? ""
          : ` (${formatNumber(regulatoryMinimumCurrent, 2)} A)`) +
        `, por encima de los ${formatNumber(calculation.totalVa / 1000, 2)} kVA ` +
        `(${formatNumber(calculation.currentLine, 2)} A) que resultan del factor de potencia.` +
        (overPdu ? " La PDU sugerida no cubre ese mínimo reglamentario." : ""),
    });
  }

  if (
    calculation.phaseMode === "three" &&
    nonLinearWattsShare !== null &&
    nonLinearWattsShare > TRIPLEN_HARMONIC_NEUTRAL_THRESHOLD
  ) {
    findings.push({
      code: "itc-bt-19-neutral-harmonics",
      reference: "UNE-HD 60364-5-52 Anexo E / REBT ITC-BT-19",
      // A scope caveat, not a defect in the number: nothing here can be
      // recalculated without per-fixture harmonic data.
      severity: "info",
      message:
        `El ${formatNumber(nonLinearWattsShare * 100, 0)} % de la carga declarada es electrónica ` +
        "(LED, descarga, fuentes conmutadas). Con ese contenido de tercer armónico el neutro " +
        "puede superar la corriente de línea y pasa a fijar la sección del cable; el valor " +
        "calculado aquí es únicamente la corriente de línea.",
    });
  }

  if (includesHoist) {
    findings.push({
      code: "itc-bt-47-motor-feed",
      reference: "REBT ITC-BT-47 apdo. 3.1",
      severity: "info",
      message:
        "La toma de motores queda fuera de estos totales. Dimensiónela aparte al " +
        `${formatNumber(ITC_BT_47_MOTOR_CURRENT_FACTOR * 100, 0)} % de la intensidad a plena ` +
        "carga del motor.",
    });
  }

  return {
    dischargeWatts,
    nonLinearWattsShare,
    regulatoryMinimumVa,
    regulatoryMinimumCurrent,
    findings,
  };
};
