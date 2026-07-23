import {
  getPerJobMultiplier
} from '@/lib/tourRateMath';
import { TourJobRateQuote } from '@/types/tourRates';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';


export const NON_AUTONOMO_DEDUCTION_EUR = 30;
// Fixed travel rate for house techs and assignable management users
export const FIXED_TRAVEL_RATE_EUR = 20;
export const DEDUCTION_DISCLAIMER_TEXT = '* Se ha aplicado una deducción de 30€/día en concepto de IRPF por condición de no autónomo.';
export const TOUR_DEDUCTION_DISCLAIMER_TEXT = '* Deducción de 30€ en concepto de IRPF por condición de no autónomo ya aplicada a la tarifa base antes de multiplicadores.';
export const EVENTO_DISCLAIMER_TEXT = '* Evento: tarifa fija de 12h (base + plus) independientemente de las horas trabajadas.';
export const PREP_DAY_DISCLAIMER_TEXT = '* Día de preparación: importe calculado a 15€/h sobre horas redondeadas y separado de la tarifa normal del bolo.';
export const FIXED_TRAVEL_RATE_DISCLAIMER_TEXT = `* (plantilla): Tarifa fija de ${FIXED_TRAVEL_RATE_EUR}€ para días de viaje de técnicos en plantilla y gestión asignables.`;

export interface TechnicianProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  default_timesheet_category?: string | null;
  role?: string | null;
  autonomo?: boolean | null;
  is_house_tech?: boolean | null;
}

export interface JobDetails {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  tour_id?: string | null;
  job_type?: string | null;
  invoicing_company?: string | null;
}

export interface TourSummaryJob {
  job: JobDetails;
  quotes: TourJobRateQuote[];
  lpoMap?: Map<string, string | null>;
}

export interface PayoutData {
  job_id: string;
  technician_id: string;
  timesheets_total_eur: number;
  extras_total_eur: number;
  expenses_total_eur: number;
  total_eur: number;
  extras_breakdown?: {
    items?: Array<{
      extra_type: string;
      quantity: number;
      unit_eur: number;
      amount_eur: number;
      is_house_tech_rate?: boolean;
    }>;
  };
  expenses_breakdown?: Array<{
    category_slug: string;
    approved_total_eur?: number;
    submitted_total_eur?: number;
    draft_total_eur?: number;
    rejected_total_eur?: number;
  }>;
  vehicle_disclaimer?: boolean;
  vehicle_disclaimer_text?: string;
  // Payout override fields (when manual override is set)
  has_override?: boolean; // True if override_amount_eur is set
  override_amount_eur?: number; // Manual override amount (if set)
  calculated_total_eur?: number; // Original calculated amount (before override)
  override_set_at?: string;
  override_actor_name?: string;
  override_actor_email?: string;
}


export interface TimesheetLine {
  date?: string | null;
  hours_rounded?: number;
  base_day_eur?: number;
  plus_10_12_hours?: number;
  plus_10_12_amount_eur?: number;
  overtime_hours?: number;
  overtime_hour_eur?: number;
  overtime_amount_eur?: number;
  total_eur?: number;
  is_evento?: boolean;
  is_prep_day?: boolean;
  prep_day_hourly_rate_eur?: number;
}

export interface TechnicianNameInfo {
  name: string;
  profile?: TechnicianProfile;
  autonomo: boolean;
  is_house_tech: boolean;
}

export const getTechNameFactory = (profiles: TechnicianProfile[]) => {
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  return (id: string): TechnicianNameInfo => {
    const profile = profileMap.get(id);
    if (!profile) {
      return { name: 'Unknown', profile: undefined, autonomo: true, is_house_tech: false };
    }
    const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Unknown';
    const is_house_tech = profile.is_house_tech === true;
    // autonomo field reflects profile setting - deduction logic handles house techs separately
    const autonomo = profile.autonomo !== false;
    return { name, profile, autonomo, is_house_tech };
  };
};

export const formatJobDate = (date: string) => format(new Date(date), 'PPP', { locale: es });

export const BASE_VALUE_EPSILON = 0.5; // tolerate rounding differences when comparing backend totals
export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const computeEffectiveBase = (quote: TourJobRateQuote) => {
  const rawMultiplier = getPerJobMultiplier(quote);
  const appliedMultiplier = rawMultiplier ?? 1;

  const breakdownBase =
    quote.breakdown?.after_discount ?? quote.breakdown?.base_calculation ?? undefined;
  const backendBase = Number(quote.base_day_eur ?? 0);
  const preMultiplierBase = Number(breakdownBase ?? backendBase);
  const recalculated = roundCurrency(preMultiplierBase * appliedMultiplier);
  const extrasTotal = Number(quote.extras_total_eur ?? 0);

  const usedFallbackBase = breakdownBase == null;

  let effectiveBase = recalculated;

  if (usedFallbackBase || rawMultiplier == null) {
    // Without explicit multiplier data we trust the backend value to avoid double application.
    effectiveBase = backendBase;
  } else if (Math.abs(recalculated - backendBase) <= BASE_VALUE_EPSILON) {
    // Treat small differences as rounding noise and align with backend totals.
    effectiveBase = backendBase;
  }

  return {
    effectiveBase,
    extrasTotal,
    preMultiplierBase,
    rawMultiplier,
    usedFallbackBase,
  };
};

export const resolveEffectiveTotal = (
  quote: TourJobRateQuote,
  computed?: ReturnType<typeof computeEffectiveBase>
): number => {
  if (quote.breakdown?.error) return 0;

  const { effectiveBase, extrasTotal } = computed ?? computeEffectiveBase(quote);
  const computedTotal = effectiveBase + extrasTotal;

  const serverTotal =
    quote.total_with_extras_eur != null
      ? Number(quote.total_with_extras_eur)
      : quote.total_eur != null
        ? Number(quote.total_eur)
        : null;

  if (quote.has_override && quote.override_amount_eur != null) {
    return Number(quote.override_amount_eur);
  }

  return serverTotal ?? computedTotal;
};

export const withLpo = (name: string, lpo?: string | null) => (lpo ? `${name}\nLPO: ${lpo}` : name);
export const normalizeVehicleDisclaimerText = (text?: string | null) => {
  if (!text) return '';
  return text.includes('Fuel/drive compensation')
    ? 'Puede aplicarse compensación de combustible/conducción al usar vehículo propio. Coordina con RR. HH. por cada trabajo.'
    : text;
};

// Generate PDF for individual rate quote (single job date)
