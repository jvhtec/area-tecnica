import { FLEX_FOLDER_IDS, RESPONSIBLE_PERSON_IDS } from '@/utils/flex-folders/constants';

export const WORK_ORDER_DEFINITION_ID = FLEX_FOLDER_IDS.ordenTrabajo;
export const DEFAULT_LOCATION_ID = FLEX_FOLDER_IDS.location;
export const PERSONNEL_RESPONSIBLE_ID = RESPONSIBLE_PERSON_IDS.personnel;
export const CURRENCY_EUR_ID = 'd3d53320-6926-11ea-9bb5-2a0a4490a7fb';
export const PRICING_MODEL_BASE_2025_ID = 'a4307bf9-cd39-4df1-9d6d-48932120c4bd';
export const PRICING_MODEL_DIA_TOUR_ID = '04c62780-c51d-11ea-a087-2a0a4490a7fb';

export function technicianDisplayName(profile?: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const first = profile?.first_name?.trim();
  const last = profile?.last_name?.trim();
  return [first, last].filter(Boolean).join(' ') || 'Sin nombre';
}
