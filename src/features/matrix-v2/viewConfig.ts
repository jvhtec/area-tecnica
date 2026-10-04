import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import type { InspectorTarget } from '@/features/matrix-v2/inspector/environment';
import type { MatrixCommandSource } from '@/features/matrix-v2/types';

/** What the grid needs beyond its usual props to run the Matrix v2 surfaces. */
export interface MatrixV2ViewConfig {
  runner: MatrixCommandRunner;
  roleSlotsByJob: Map<string, RoleSlot[]>;
  lastRoleByTechnician: Map<string, string>;
  /** Which cell's inspector is open, if any. Owned by the container so cell buttons and keys can open it. */
  inspectorTarget: InspectorTarget | null;
  /** Opens the inspector, or closes it when it is already open on that cell (a second click). */
  toggleInspector: (technicianId: string, date: Date, anchor: HTMLElement | null) => void;
  openInspector: (technicianId: string, date: Date, anchor: HTMLElement | null, intent?: InspectorTarget['intent']) => void;
  closeInspector: () => void;
  /** Confirms an invited technician at once (with Deshacer). */
  quickConfirm: (technicianId: string, date: Date, source?: MatrixCommandSource) => void;
  /** Marks or lifts a day's unavailability. */
  toggleUnavailable: (technicianId: string, dateKey: string) => void;
}
