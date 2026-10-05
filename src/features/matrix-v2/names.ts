import { formatUserName } from '@/utils/userName';
import type { MatrixTechnicianRef } from '@/features/matrix-v2/types';

/** "Marta I." style name used in toasts and result rows. */
export const technicianDisplayName = (technician: MatrixTechnicianRef | undefined): string =>
  (technician ? formatUserName(technician.first_name ?? '', technician.nickname ?? null, technician.last_name ?? '') : '') || 'Técnico';
