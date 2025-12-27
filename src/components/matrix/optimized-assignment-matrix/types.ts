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

export interface CellAction {
  type:
    | "select-job"
    | "select-job-for-staffing"
    | "assign"
    | "unavailable"
    | "confirm"
    | "decline"
    | "offer-details"
    | "offer-details-wa"
    | "offer-details-email"
    | "availability-wa"
    | "availability-email";
  technicianId: string;
  date: Date;
  assignment?: any;
  selectedJobId?: string;
  singleDay?: boolean;
  intendedPhase?: "availability" | "offer";
  intendedChannel?: "email" | "whatsapp";
}

export interface OptimizedAssignmentMatrixExtendedProps extends OptimizedAssignmentMatrixProps {
  onNearEdgeScroll?: (direction: "before" | "after") => void;
  canExpandBefore?: boolean;
  canExpandAfter?: boolean;
  allowDirectAssign?: boolean;
  fridgeSet?: Set<string>;
  cellWidth?: number;
  cellHeight?: number;
  technicianWidth?: number;
  headerHeight?: number;
  mobile?: boolean;
}

