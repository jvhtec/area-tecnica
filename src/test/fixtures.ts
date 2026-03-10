export interface TestAuthState {
  session: { user: { id: string; email?: string | null } } | null;
  user: { id: string; email?: string | null } | null;
  userRole: string | null;
  userDepartment: string | null;
  hasSoundVisionAccess: boolean;
  assignableAsTech: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isProfileLoading: boolean;
  error: string | null;
}

export const createAuthState = (
  overrides: Partial<TestAuthState> = {},
): TestAuthState => ({
  session: { user: { id: "user-1", email: "user@example.com" } },
  user: { id: "user-1", email: "user@example.com" },
  userRole: "management",
  userDepartment: "sound",
  hasSoundVisionAccess: false,
  assignableAsTech: false,
  isLoading: false,
  isInitialized: true,
  isProfileLoading: false,
  error: null,
  ...overrides,
});

export const createJob = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  title: "Test Job",
  job_type: "single",
  start_time: "2025-01-01T08:00:00Z",
  end_time: "2025-01-01T20:00:00Z",
  status: "confirmed",
  flex_folders: [],
  ...overrides,
});

export const createAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: "assignment-1",
  job_id: "job-1",
  technician_id: "tech-1",
  sound_role: "foh",
  lights_role: null,
  video_role: null,
  single_day: false,
  assignment_date: null,
  status: "confirmed",
  assigned_at: "2025-01-01T08:00:00Z",
  ...overrides,
});

export const createTimesheet = (overrides: Record<string, unknown> = {}) => ({
  id: "timesheet-1",
  job_id: "job-1",
  technician_id: "tech-1",
  date: "2025-01-01",
  is_active: true,
  approved_by_manager: false,
  status: "draft",
  ...overrides,
});

export const createTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  job_id: "job-1",
  tour_id: null,
  task_type: "Pesos",
  status: "not_started",
  progress: 0,
  assigned_to: "user-2",
  ...overrides,
});

export const createExpense = (overrides: Record<string, unknown> = {}) => ({
  id: "expense-1",
  job_id: "job-1",
  technician_id: "tech-1",
  category_slug: "dietas",
  expense_date: "2025-01-01",
  amount_eur: 45,
  amount_original: 45,
  currency_code: "EUR",
  status: "submitted",
  receipt_path: null,
  description: null,
  ...overrides,
});

export const createEquipmentStockEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "stock-1",
  equipment_id: "equipment-1",
  base_quantity: 4,
  equipment: {
    id: "equipment-1",
    category: "wireless",
    name: "QLX-D",
  },
  ...overrides,
});
