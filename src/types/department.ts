
export type Department = "sound" | "lights" | "video" | "production" | "administrative";

// Technical departments - used for jobs and tours (excludes administrative)
export type TechnicalDepartment = "sound" | "lights" | "video" | "production";

// Department labels in Spanish
export const DEPARTMENT_LABELS: Record<Department, string> = {
  sound: "Sonido",
  lights: "Iluminación",
  video: "Video",
  production: "Producción",
  administrative: "Administración",
};

// All departments (for user management)
export const ALL_DEPARTMENTS: Department[] = [
  "sound",
  "lights",
  "video",
  "production",
  "administrative",
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
];
