import type { RoleSlot } from "@/features/matrix-v2/roleSlots";

// Technician sorting method type
export type TechSortMethod =
  | "default"
  | "location"
  | "name-asc"
  | "name-desc"
  | "surname-asc"
  | "surname-desc";

// Define the specific job type that matches what's passed from JobAssignmentMatrix
export interface MatrixJob {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  status: string;
  job_type: string;
}

export interface OptimizedAssignmentMatrixProps {
  technicians: Array<{
    id: string;
    first_name: string;
    nickname?: string | null;
    last_name: string;
    email: string;
    phone?: string | null;
    dni?: string | null;
    department: string;
    role: string;
    bg_color?: string | null;
    skills?: Array<{ name?: string; category?: string | null; proficiency?: number | null; is_primary?: boolean | null }>;
  }>;
  dates: Date[];
  jobs: MatrixJob[];
}

export interface OptimizedAssignmentMatrixExtendedProps extends OptimizedAssignmentMatrixProps {
  onNearEdgeScroll?: (direction: "before" | "after") => void;
  canExpandBefore?: boolean;
  canExpandAfter?: boolean;
  fridgeSet?: Set<string>;
  cellWidth?: number;
  cellHeight?: number;
  technicianWidth?: number;
  headerHeight?: number;
  mobile?: boolean;
  staffingDepartment?: string | null;
  /** Role slots per job, from the page's staffing-summary query. */
  roleSlotsByJob?: Map<string, RoleSlot[]>;
  /** Job focus: which job the grid is judged against, and the status new assignments get. */
  focusJobId?: string | null;
  focusStatus?: 'invited' | 'confirmed';
  onFocusJobChange?: (jobId: string | null) => void;
}
