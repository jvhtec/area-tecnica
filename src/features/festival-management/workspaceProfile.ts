import type { JobType } from "@/types/job";

export type JobWorkspaceModule = "artists" | "gear" | "scheduling" | "riderLibrary";
export type JobWorkspaceIcon = "festival" | "cycle" | "single" | "event" | "tourdate";

export type JobWorkspaceProfile = {
  actionLabel: string;
  badgeLabel: string;
  backLabel: string;
  defaultStageCount: number;
  icon: JobWorkspaceIcon;
  modules: Record<JobWorkspaceModule, boolean>;
  schedulingTitle: string;
  viewActionLabel: string;
  workspaceLabel: string;
};

const ALL_MODULES: Record<JobWorkspaceModule, boolean> = {
  artists: true,
  gear: true,
  riderLibrary: true,
  scheduling: true,
};

const profile = (
  values: Omit<JobWorkspaceProfile, "defaultStageCount" | "modules">,
): JobWorkspaceProfile => ({
  ...values,
  defaultStageCount: 1,
  modules: { ...ALL_MODULES },
});

const PROFILES: Record<Exclude<JobType, "dryhire" | "tour">, JobWorkspaceProfile> = {
  festival: profile({
    actionLabel: "Gestionar festival",
    badgeLabel: "Festival",
    backLabel: "Volver al festival",
    icon: "festival",
    schedulingTitle: "Planificación del festival",
    viewActionLabel: "Ver festival",
    workspaceLabel: "Producción del festival",
  }),
  ciclo: profile({
    actionLabel: "Gestionar ciclo",
    badgeLabel: "Ciclo",
    backLabel: "Volver al ciclo",
    icon: "cycle",
    schedulingTitle: "Planificación del ciclo",
    viewActionLabel: "Ver ciclo",
    workspaceLabel: "Producción del ciclo",
  }),
  single: profile({
    actionLabel: "Gestionar bolo",
    badgeLabel: "Bolo",
    backLabel: "Volver al bolo",
    icon: "single",
    schedulingTitle: "Planificación del bolo",
    viewActionLabel: "Ver bolo",
    workspaceLabel: "Producción del bolo",
  }),
  evento: profile({
    actionLabel: "Gestionar evento",
    badgeLabel: "Evento",
    backLabel: "Volver al evento",
    icon: "event",
    schedulingTitle: "Planificación del evento",
    viewActionLabel: "Ver evento",
    workspaceLabel: "Producción del evento",
  }),
  tourdate: profile({
    actionLabel: "Gestionar fecha de gira",
    badgeLabel: "Fecha de gira",
    backLabel: "Volver a la fecha de gira",
    icon: "tourdate",
    schedulingTitle: "Planificación de la fecha de gira",
    viewActionLabel: "Ver fecha de gira",
    workspaceLabel: "Producción de la fecha de gira",
  }),
};

const FALLBACK_PROFILE = profile({
  actionLabel: "Gestionar producción",
  badgeLabel: "Trabajo",
  backLabel: "Volver al trabajo",
  icon: "single",
  schedulingTitle: "Planificación del trabajo",
  viewActionLabel: "Ver producción",
  workspaceLabel: "Producción del trabajo",
});

/**
 * Describes the shared production workspace without changing its routes or
 * enabled modules. Legacy links that still include `?singleJob=true` remain
 * valid because the profile is derived exclusively from the persisted job.
 */
export const getJobWorkspaceProfile = (
  jobType: JobType | string | null | undefined,
): JobWorkspaceProfile => {
  if (jobType && Object.prototype.hasOwnProperty.call(PROFILES, jobType)) {
    return PROFILES[jobType as keyof typeof PROFILES];
  }

  return FALLBACK_PROFILE;
};
