import type { MatrixJob, MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import type { MatrixStaffingStatus } from '@/components/matrix/optimized-matrix-cell/types';
import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import type { MatrixTechnicianRef } from '@/features/matrix-v2/types';

export interface InspectorTechnician extends MatrixTechnicianRef {
  first_name: string;
  last_name: string;
  department: string;
}

export interface InspectorAvailability {
  status?: string | null;
  reason?: string | null;
  notes?: string | null;
  source?: string | null;
}

/**
 * Everything the inspector reads from the grid, handed over as one object so the
 * inspector itself never needs the matrix's dozens of props. The grid builds it
 * once per data change.
 */
export interface InspectorEnvironment {
  runner: MatrixCommandRunner;
  getTechnician: (technicianId: string) => InspectorTechnician | undefined;
  getJob: (jobId: string) => MatrixJob | undefined;
  getJobsForDate: (date: Date) => MatrixJob[];
  getAssignmentForCell: (technicianId: string, date: Date) => MatrixTimesheetAssignment | undefined;
  getAvailabilityForCell: (technicianId: string, date: Date) => InspectorAvailability | undefined;
  roleSlotsByJob: Map<string, RoleSlot[]>;
  /** The role each technician held most recently, to suggest it again. */
  lastRoleByTechnician: Map<string, string>;
  declinedJobIds: (technicianId: string) => ReadonlySet<string> | undefined;
  isFridge: (technicianId: string) => boolean;
  staffingByDate: (technicianId: string, dateKey: string) => MatrixStaffingStatus | null;
  profileNames: Map<string, string>;
  /** Managers assign; everyone else gets a read-only inspector. */
  canAssign: boolean;
  canMarkUnavailable: boolean;
  /** The job a Job focus session is staffing, if any. */
  focusJobId?: string | null;
  /** Hands staffing requests (availability, offers) to the staffing flow. */
  openStaffing: (technicianId: string, date: Date) => void;
}

export interface InspectorTarget {
  technicianId: string;
  date: Date;
  dateKey: string;
  /** The clicked cell, so the popover can sit next to it; null on touch. */
  anchor: HTMLElement | null;
}
