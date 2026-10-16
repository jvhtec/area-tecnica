import { getErrorMessage } from '@/utils/errorMessage';
import {
  REJECTION_CODES,
  type AssignmentCommandCode,
  type AssignmentCommandResult,
  type AssignmentFailureCode,
  type AssignmentRejectionCode,
} from '@/features/assignments/commands/types';

const MESSAGES: Record<AssignmentCommandCode, string> = {
  stale_state: 'Otra persona ha modificado esta asignación mientras la editabas. Se han recargado los datos; revisa y vuelve a intentarlo.',
  conflict: 'El técnico ya tiene trabajo en alguna de esas fechas.',
  job_not_found: 'El trabajo ya no existe.',
  technician_not_found: 'El técnico ya no existe.',
  role_department_mismatch: 'El rol no corresponde al departamento del técnico.',
  invalid_job_span: 'El trabajo no tiene fechas válidas para asignarlo completo.',
  last_date: 'Es el último día de la asignación: elimina la asignación completa.',
  assignment_not_found: 'La asignación ya no existe.',
  dryhire_job: 'Los trabajos de dry hire no llevan personal asignado.',
  invalid_role: 'El rol no es un rol válido. Elige uno de la lista.',
  approved_timesheet: 'Hay partes aprobados en esos días. Los partes aprobados no se eliminan desde una asignación: anula primero la aprobación.',
  permission_denied: 'No tienes permiso para modificar asignaciones.',
  invalid_request: 'La solicitud de asignación no es válida.',
  command_id_reused: 'Esta operación ya se usó para otro cambio. Vuelve a intentarlo.',
  concurrent_write: 'Otra operación ha modificado esta asignación al mismo tiempo. Recarga e inténtalo de nuevo.',
  network: 'Error de red: no se pudo confirmar el cambio. Comprueba la conexión e inténtalo de nuevo.',
  unknown: 'No se pudo completar la operación de asignación.',
};

/** Return the Spanish user-facing message for a classified command outcome. */
export const assignmentCommandMessage = (code: AssignmentCommandCode): string => MESSAGES[code];

/** Narrow a returned code to the recognized database rejection vocabulary. */
export const isRejectionCode = (code: string | undefined): code is AssignmentRejectionCode =>
  typeof code === 'string' && (REJECTION_CODES as readonly string[]).includes(code);

/**
 * A command that did not commit. `retryable` failures may be retried with the
 * SAME command id (the database replays a committed outcome instead of
 * repeating it); rejections need a new decision and a new command id.
 */
export class AssignmentCommandError extends Error {
  readonly code: AssignmentCommandCode;
  readonly retryable: boolean;
  readonly result: AssignmentCommandResult | null;

  constructor(code: AssignmentCommandCode, options: { message?: string; result?: AssignmentCommandResult | null; cause?: unknown } = {}) {
    super(options.message ?? MESSAGES[code]);
    this.name = 'AssignmentCommandError';
    this.code = code;
    this.retryable = code === 'network';
    this.result = options.result ?? null;
    if (options.cause !== undefined) {
      Object.defineProperty(this, 'cause', { value: options.cause, enumerable: false });
    }
  }
}

/** Read a structured RPC error code without assuming a transport error shape. */
const readCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error;
  return typeof code === 'string' ? code : undefined;
};

/** Maps a PostgREST/transport error from an RPC call onto the vocabulary. */
export function classifyAssignmentRpcError(error: unknown): AssignmentCommandError {
  const code = readCode(error);
  const message = getErrorMessage(error, '');
  let classified: AssignmentFailureCode = 'unknown';
  if (code === '42501') classified = 'permission_denied';
  else if (code === '22023') classified = 'invalid_request';
  else if (code === '23505') classified = message.includes('command_id_reused') ? 'command_id_reused' : 'concurrent_write';
  else if (code === '40P01' || code === '55P03' || code === '40001') classified = 'concurrent_write';
  else if (!code && /fetch|network|timeout|abort/i.test(message)) classified = 'network';
  return new AssignmentCommandError(classified, { cause: error });
}

/** Shown when the authoritative state could not be loaded: commands refuse to run blind. */
export const ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE =
  'No se pudo cargar el estado actual de la asignación. Recarga e inténtalo de nuevo.';
