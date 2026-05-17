import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

import type { AssignmentLifecycleResult } from '@/components/matrix/optimized-matrix-cell/types';

export const EMPTY_PROFILE_NAMES_MAP = new Map<string, string>();

export const normalizeStatus = (status?: string | null) => status?.trim().toLowerCase() ?? null;

export const formatDateTimeEs = (iso?: string | null) => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatInTimeZone(parsed, 'Europe/Madrid', 'd MMM yyyy, HH:mm', { locale: es });
};

export const assignmentStatusLabel = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === 'confirmed') return 'Confirmado';
  if (normalizedStatus === 'declined') return 'Rechazado';
  if (normalizedStatus === 'invited') return 'Invitado';
  return 'Pendiente';
};

export const availabilityStatusLabel = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === 'requested' || normalizedStatus === 'pending') return 'Solicitada';
  if (normalizedStatus === 'confirmed') return 'Confirmada';
  if (normalizedStatus === 'declined') return 'Rechazada';
  return null;
};

export const offerStatusLabel = (status?: string | null) => {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === 'sent' || normalizedStatus === 'pending') return 'Enviada';
  if (normalizedStatus === 'confirmed') return 'Confirmada';
  if (normalizedStatus === 'declined') return 'Rechazada';
  return null;
};

export const readAssignmentLifecycleResult = (value: unknown): AssignmentLifecycleResult => (
  value && typeof value === 'object' ? value as AssignmentLifecycleResult : {}
);
