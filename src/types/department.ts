
// Legacy department values kept for backward compatibility with existing database records
export type LegacyDepartment = "personnel" | "comercial" | "management";

// Current active departments
export type ActiveDepartment = "sound" | "lights" | "video" | "production" | "administrative" | "logistics";

// Full Department type includes both active and legacy values for database compatibility
export type Department = ActiveDepartment | LegacyDepartment;

// Technical departments - used for jobs and tours (excludes administrative, logistics, and legacy)
export type TechnicalDepartment = "sound" | "lights" | "video" | "production";

// Department labels in Spanish (includes legacy values for display purposes)
export const DEPARTMENT_LABELS: Record<Department, string> = {
  // Active departments
  sound: "Sonido",
  lights: "Iluminación",
  video: "Video",
  production: "Producción",
  administrative: "Administración",
  logistics: "Logística",
  // Legacy departments (for backward compatibility with existing records)
  personnel: "Personal (Legacy)",
  comercial: "Comercial (Legacy)",
  management: "Gestión (Legacy)",
};

// Active departments only (for new user creation)
export const ACTIVE_DEPARTMENTS: ActiveDepartment[] = [
  "sound",
  "lights",
  "video",
  "production",
  "administrative",
  "logistics",
];

// All departments including legacy (for editing existing records)
export const ALL_DEPARTMENTS: Department[] = [
  "sound",
  "lights",
  "video",
  "production",
  "administrative",
  "logistics",
  "personnel",
  "comercial",
  "management",
];

// Technical departments only (for jobs and tours)
export const TECHNICAL_DEPARTMENTS: TechnicalDepartment[] = [
  "sound",
  "lights",
  "video",
  "production",
];

// Management departments - users in these departments must have management roles
export const MANAGEMENT_DEPARTMENTS: Department[] = [
  "production",
  "administrative",
  "logistics",
];

// Helper function to get department label with fallback
export const getDepartmentLabel = (department: string | null | undefined): string => {
  if (!department) return "Sin departamento";
  return DEPARTMENT_LABELS[department as Department] || department || "Desconocido";
};
