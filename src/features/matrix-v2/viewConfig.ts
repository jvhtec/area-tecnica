import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';

/** What the grid needs beyond its usual props to run the Matrix v2 surfaces. */
export interface MatrixV2ViewConfig {
  runner: MatrixCommandRunner;
  roleSlotsByJob: Map<string, RoleSlot[]>;
  lastRoleByTechnician: Map<string, string>;
}
