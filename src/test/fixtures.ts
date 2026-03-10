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

export type RouteShellRole =
  | "guest"
  | "admin"
  | "management"
  | "house_tech"
  | "technician"
  | "oscar"
  | "logistics";

export const createRouteShellAuthState = (
  role: RouteShellRole,
  overrides: Partial<TestAuthState> = {},
): TestAuthState => {
  if (role === "guest") {
    return createAuthState({
      session: null,
      user: null,
      userRole: null,
      userDepartment: null,
      assignableAsTech: false,
      hasSoundVisionAccess: false,
      ...overrides,
    });
  }

  const departmentByRole: Record<Exclude<RouteShellRole, "guest">, string | null> = {
    admin: "sound",
    management: "sound",
    house_tech: "sound",
    technician: "sound",
    oscar: null,
    logistics: "logistics",
  };

  return createAuthState({
    session: { user: { id: `${role}-user`, email: `${role}@example.com` } },
    user: { id: `${role}-user`, email: `${role}@example.com` },
    userRole: role,
    userDepartment: departmentByRole[role],
    assignableAsTech: role === "management" ? false : overrides.assignableAsTech ?? false,
    ...overrides,
  });
};

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

export const createTechnicianProfile = (overrides: Record<string, unknown> = {}) => ({
  id: "tech-1",
  first_name: "Pat",
  last_name: "Jones",
  email: "pat@example.com",
  role: "technician",
  department: "sound",
  assignable_as_tech: false,
  soundvision_access_enabled: false,
  tours_expanded: true,
  ...overrides,
});

export const createUserProfile = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  first_name: "Alex",
  last_name: "Manager",
  email: "alex@example.com",
  role: "management",
  department: "sound",
  phone: "+34123456789",
  assignable_as_tech: false,
  soundvision_access_enabled: false,
  autonomo: true,
  ...overrides,
});

export const createVacationRequest = (overrides: Record<string, unknown> = {}) => ({
  id: "vacation-1",
  technician_id: "tech-1",
  start_date: "2026-06-01",
  end_date: "2026-06-03",
  status: "pending",
  reason: "Descanso",
  created_at: "2026-03-10T08:00:00Z",
  updated_at: "2026-03-10T08:00:00Z",
  technicians: {
    first_name: "Pat",
    last_name: "Jones",
    department: "sound",
    email: "pat@example.com",
  },
  ...overrides,
});

export const createTour = (overrides: Record<string, unknown> = {}) => ({
  id: "tour-1",
  name: "Test Tour",
  description: "Wave two test tour",
  color: "#2563eb",
  start_date: "2026-04-01",
  end_date: "2026-04-03",
  tour_dates: [],
  ...overrides,
});

export const createTourDate = (overrides: Record<string, unknown> = {}) => ({
  id: "tour-date-1",
  tour_id: "tour-1",
  date: "2026-04-01T20:00:00Z",
  notes: "Load-in at noon",
  location: {
    id: "location-1",
    name: "WiZink Center",
  },
  ...overrides,
});

export const createIncidentReport = (overrides: Record<string, unknown> = {}) => ({
  id: "incident-1",
  job_id: "job-1",
  file_name: "incident-report.pdf",
  file_path: "incident-reports/incident-report.pdf",
  file_type: "application/pdf",
  file_size: 1024,
  uploaded_by: "tech-1",
  uploaded_at: "2026-03-10T12:00:00Z",
  job: {
    id: "job-1",
    title: "Test Job",
    start_time: "2026-03-10T08:00:00Z",
    end_time: "2026-03-10T20:00:00Z",
  },
  uploaded_by_profile: {
    first_name: "Pat",
    last_name: "Jones",
  },
  ...overrides,
});

export const createSoundVisionAccessState = (enabled: boolean, overrides: Partial<TestAuthState> = {}) =>
  createAuthState({
    hasSoundVisionAccess: enabled,
    userRole: overrides.userRole ?? "management",
    userDepartment: overrides.userDepartment ?? "sound",
    ...overrides,
  });
