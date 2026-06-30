import React, { lazy } from "react";
import { Navigate, generatePath, matchPath } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import type { UserRole } from "@/types/user";
import {
  DASHBOARD_ALLOWED_ROLES,
  MANAGEMENT_ALLOWED_ROLES,
  MANAGEMENT_AND_HOUSE_TECH_ALLOWED_ROLES,
  PROJECT_MANAGEMENT_ALLOWED_ROLES,
  canAccessDisponibilidad,
  canManagePayouts,
  hasTechnicianSelfServiceAccess,
  isAdminRole,
} from "@/utils/permissions";

type RouteComponent = React.LazyExoticComponent<React.ComponentType<Record<string, never>>>;
type LayoutKind = "public" | "fullscreen" | "app";
type SubscriptionPriority = "high" | "medium" | "low";

export type SubscriptionTableRequirement = {
  table: string;
  priority: SubscriptionPriority;
};

export type SubscriptionProfile = readonly SubscriptionTableRequirement[];

type RouteAccessPolicy = {
  allowedRoles?: readonly UserRole[];
  allowAssignableTech?: boolean;
  wrap: (element: React.ReactElement) => React.ReactElement;
};

const withRoleAccess = (
  allowedRoles: readonly UserRole[],
  options: { allowAssignableTech?: boolean; guard?: React.ComponentType<{ children: React.ReactNode }> } = {},
): RouteAccessPolicy => ({
  allowedRoles,
  allowAssignableTech: options.allowAssignableTech,
  wrap: (element) => {
    const guardedElement = options.guard
      ? React.createElement(options.guard, null, element)
      : element;

    return (
      <ProtectedRoute
        allowedRoles={allowedRoles}
        allowAssignableTech={options.allowAssignableTech}
      >
        {guardedElement}
      </ProtectedRoute>
    );
  },
});

const passThroughAccess: RouteAccessPolicy = {
  wrap: (element) => element,
};

const SOUND_DEPARTMENT = "sound";
const SOUND_TOOL_ROLES = ["admin", "management", "house_tech"] as const;
const SOUND_TOOL_ROLES_WITH_TECH = [...SOUND_TOOL_ROLES, "technician"] as const;
const PERSONAL_ALLOWED_ROLES = ["admin", "management", "logistics", "house_tech"] as const;
const TASKS_ALLOWED_ROLES = ["admin", "management", "logistics", "house_tech", "oscar"] as const;
const UNAVAILABILITY_ALLOWED_ROLES = ["house_tech", "admin", "management"] as const;
const PROJECT_AND_HOUSE_TECH_ALLOWED_ROLES = [...PROJECT_MANAGEMENT_ALLOWED_ROLES, "house_tech"] as const;

const RedirectingAccessLoader = (): null => null;

const FestivalsDepartmentGuard = ({ children }: { children: React.ReactNode }) => {
  const { userRole, userDepartment, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return <RedirectingAccessLoader />;
  }

  const isAdmin = isAdminRole(userRole);
  const isSoundMember = userDepartment?.toLowerCase() === SOUND_DEPARTMENT;

  if (!isAdmin && !isSoundMember) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const DisponibilidadDepartmentGuard = ({ children }: { children: React.ReactNode }) => {
  const { userRole, userDepartment, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return <RedirectingAccessLoader />;
  }

  if (!canAccessDisponibilidad(userRole, userDepartment)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const PayoutsDueDepartmentGuard = ({ children }: { children: React.ReactNode }) => {
  const { userRole, userDepartment, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return <RedirectingAccessLoader />;
  }

  if (!canManagePayouts(userRole, userDepartment)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const TechnicianSelfServiceGuard = ({ children }: { children: React.ReactNode }) => {
  const { userRole, assignableAsTech, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return <RedirectingAccessLoader />;
  }

  if (hasTechnicianSelfServiceAccess(userRole, assignableAsTech)) {
    return <>{children}</>;
  }

  return <Navigate to="/dashboard" replace />;
};

export const accessPolicies = {
  public: passThroughAccess,
  authenticated: passThroughAccess,
  adminOnly: withRoleAccess(["admin"]),
  dashboard: withRoleAccess(DASHBOARD_ALLOWED_ROLES),
  management: withRoleAccess(MANAGEMENT_ALLOWED_ROLES),
  managementAndHouseTech: withRoleAccess(MANAGEMENT_AND_HOUSE_TECH_ALLOWED_ROLES),
  personal: withRoleAccess(PERSONAL_ALLOWED_ROLES),
  projectOperations: withRoleAccess(PROJECT_MANAGEMENT_ALLOWED_ROLES),
  projectAndHouseTech: withRoleAccess(PROJECT_AND_HOUSE_TECH_ALLOWED_ROLES),
  tasks: withRoleAccess(TASKS_ALLOWED_ROLES),
  technicianApp: withRoleAccess(["technician"], { allowAssignableTech: true }),
  technicianDashboard: withRoleAccess(["house_tech"], { allowAssignableTech: true }),
  technicianUnavailability: withRoleAccess(UNAVAILABILITY_ALLOWED_ROLES, {
    guard: TechnicianSelfServiceGuard,
  }),
  festivals: withRoleAccess(MANAGEMENT_AND_HOUSE_TECH_ALLOWED_ROLES, {
    guard: FestivalsDepartmentGuard,
  }),
  disponibilidad: withRoleAccess(MANAGEMENT_ALLOWED_ROLES, {
    guard: DisponibilidadDepartmentGuard,
  }),
  payoutsDue: withRoleAccess(MANAGEMENT_ALLOWED_ROLES, {
    guard: PayoutsDueDepartmentGuard,
  }),
  soundTools: withRoleAccess(SOUND_TOOL_ROLES),
  soundToolsWithTechnician: withRoleAccess(SOUND_TOOL_ROLES_WITH_TECH),
} as const;

export type AccessPolicyId = keyof typeof accessPolicies;

export type NavConfig = {
  id: string;
  label: string;
  mobileLabel?: string;
  shortcut?: {
    id: string;
    keybind?: string;
    icon?: string;
  };
};

export type BreadcrumbConfig = {
  label: string;
  parentPath?: string;
};

export type AppRoute = {
  id: string;
  path: string;
  component: RouteComponent;
  layout: LayoutKind;
  access: AccessPolicyId;
  subscriptions?: SubscriptionProfileId;
  subscriptionRouteKey?: string;
  nav?: NavConfig;
  breadcrumb?: BreadcrumbConfig;
  chrome?: {
    suppress?: boolean;
    mobileFullscreen?: boolean;
  };
};

const lazyPage = (importer: () => Promise<{ default: React.ComponentType<Record<string, never>> }>): RouteComponent =>
  lazy(importer);

const Auth = lazyPage(() => import("@/pages/Auth"));
const Dashboard = lazyPage(() => import("@/pages/Dashboard"));
const Sound = lazyPage(() => import("@/pages/Sound"));
const Lights = lazyPage(() => import("@/pages/Lights"));
const Video = lazyPage(() => import("@/pages/Video"));
const Profile = lazyPage(() => import("@/pages/Profile"));
const Settings = lazyPage(() => import("@/pages/Settings"));
const ProjectManagement = lazyPage(() => import("@/pages/ProjectManagement"));
const TechnicianDashboard = lazyPage(() => import("@/pages/TechnicianDashboard"));
const TechnicianUnavailability = lazyPage(() => import("@/pages/TechnicianUnavailability"));
const TechnicianSuperApp = lazyPage(() => import("@/pages/TechnicianSuperApp"));
const Personal = lazyPage(() => import("@/pages/Personal"));
const MorningSummary = lazyPage(() => import("@/pages/MorningSummary"));
const Tours = lazyPage(() => import("@/pages/Tours"));
const PesosTool = lazyPage(() => import("@/pages/PesosTool"));
const LightsPesosTool = lazyPage(() => import("@/pages/LightsPesosTool"));
const VideoPesosTool = lazyPage(() => import("@/pages/VideoPesosTool"));
const ConsumosTool = lazyPage(() => import("@/pages/ConsumosTool"));
const LightsConsumosTool = lazyPage(() => import("@/pages/LightsConsumosTool"));
const VideoConsumosTool = lazyPage(() => import("@/pages/VideoConsumosTool"));
const Logistics = lazyPage(() => import("@/pages/Logistics"));
const FestivalManagement = lazyPage(() => import("@/pages/FestivalManagement"));
const FestivalArtistManagement = lazyPage(() => import("@/pages/FestivalArtistManagement"));
const LightsMemoriaTecnica = lazyPage(() => import("@/pages/LightsMemoriaTecnica"));
const VideoMemoriaTecnica = lazyPage(() => import("@/pages/VideoMemoriaTecnica"));
const Disponibilidad = lazyPage(() => import("@/pages/Disponibilidad"));
const JobAssignmentMatrix = lazyPage(() => import("@/pages/JobAssignmentMatrix"));
const ActivityCenter = lazyPage(() => import("@/pages/ActivityCenter"));
const FestivalGearManagement = lazyPage(() => import("@/pages/FestivalGearManagement"));
const Festivals = lazyPage(() => import("@/pages/Festivals"));
const Timesheets = lazyPage(() => import("@/pages/Timesheets"));
const IncidentReports = lazyPage(() => import("@/pages/IncidentReports"));
const Wallboard = lazyPage(() => import("@/pages/Wallboard"));
const WallboardPublic = lazyPage(() => import("@/pages/WallboardPublic"));
const TourShare = lazyPage(() => import("@/pages/TourShare"));
const Announcements = lazyPage(() => import("@/pages/Announcements"));
const WallboardPresets = lazyPage(() => import("@/pages/WallboardPresets"));
const RatesCenterPage = lazyPage(() => import("@/pages/RatesCenterPage"));
const PayoutsDueFortnights = lazyPage(() => import("@/pages/PayoutsDueFortnights"));
const ExpensesPage = lazyPage(() => import("@/pages/Expenses"));
const Feedback = lazyPage(() => import("@/pages/Feedback"));
const SoundVisionFiles = lazyPage(() => import("@/pages/SoundVisionFiles"));
const Privacy = lazyPage(() => import("@/pages/Privacy"));
const StagePlot = lazyPage(() => import("@/pages/StagePlot"));
const SysCalc = lazyPage(() => import("@/pages/SysCalc"));
const GlobalTasks = lazyPage(() => import("@/pages/GlobalTasks"));
const Achievements = lazyPage(() => import("@/pages/Achievements"));

const ModernHojaDeRuta = lazy(() =>
  import("@/components/hoja-de-ruta/ModernHojaDeRuta").then((module) => ({
    default: module.ModernHojaDeRuta as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

const EquipmentManagement = lazy(() =>
  import("@/pages/EquipmentManagement").then((module) => ({
    default: module.EquipmentManagement as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

const ArtistRequirementsForm = lazy(() =>
  import("@/components/festival/ArtistRequirementsForm").then((module) => ({
    default: module.ArtistRequirementsForm as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

const ArtistRequirementsFormBlank = lazy(() =>
  import("@/components/festival/ArtistRequirementsForm").then((module) => ({
    default: function BlankArtistRequirementsForm() {
      return <module.ArtistRequirementsForm isBlank />;
    },
  })),
) as RouteComponent;

const FormSubmitted = lazy(() =>
  import("@/components/festival/FormSubmitted").then((module) => ({
    default: module.FormSubmitted as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

const TourManagementWrapper = lazy(() =>
  import("@/components/tours/TourManagementWrapper").then((module) => ({
    default: module.TourManagementWrapper as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

const UserManual = lazy(() =>
  import("@/components/UserManual").then((module) => ({
    default: module.UserManual as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

export const subscriptionProfiles = {
  dashboard: [
    { table: "jobs", priority: "high" },
    { table: "job_assignments", priority: "high" },
    { table: "job_date_types", priority: "medium" },
  ],
  department: [
    { table: "jobs", priority: "high" },
    { table: "job_assignments", priority: "high" },
    { table: "job_departments", priority: "medium" },
  ],
  technicianDashboard: [
    { table: "jobs", priority: "high" },
    { table: "job_assignments", priority: "high" },
  ],
  logistics: [
    { table: "jobs", priority: "high" },
    { table: "logistics_events", priority: "high" },
  ],
  tours: [
    { table: "tours", priority: "high" },
    { table: "tour_dates", priority: "medium" },
  ],
  tourManagement: [
    { table: "tours", priority: "high" },
    { table: "tour_dates", priority: "high" },
    { table: "tour_timeline_events", priority: "high" },
    { table: "tour_travel_segments", priority: "high" },
    { table: "tour_accommodations", priority: "medium" },
    { table: "tour_documents", priority: "medium" },
    { table: "tour_guest_links", priority: "low" },
    { table: "hoja_de_ruta", priority: "medium" },
    { table: "hoja_de_ruta_travel_arrangements", priority: "medium" },
    { table: "hoja_de_ruta_accommodations", priority: "medium" },
    { table: "hoja_de_ruta_room_assignments", priority: "medium" },
    { table: "hoja_de_ruta_staff", priority: "medium" },
    { table: "hoja_de_ruta_transport", priority: "medium" },
    { table: "job_assignments", priority: "medium" },
  ],
  projectManagement: [
    { table: "jobs", priority: "high" },
    { table: "job_assignments", priority: "medium" },
    { table: "job_departments", priority: "medium" },
  ],
  rates: [
    { table: "rate_cards_tour_2025", priority: "high" },
    { table: "rate_extras_2025", priority: "high" },
    { table: "custom_tech_rates", priority: "high" },
    { table: "timesheets", priority: "high" },
    { table: "tours", priority: "medium" },
    { table: "jobs", priority: "medium" },
    { table: "job_assignments", priority: "medium" },
  ],
  expenses: [
    { table: "job_expenses", priority: "high" },
    { table: "expense_permissions", priority: "medium" },
    { table: "expense_categories", priority: "low" },
  ],
  festivals: [
    { table: "jobs", priority: "high" },
    { table: "festival_artists", priority: "medium" },
    { table: "festival_forms", priority: "low" },
  ],
  festivalManagement: [
    { table: "festivals", priority: "high" },
    { table: "festival_artists", priority: "high" },
    { table: "festival_forms", priority: "medium" },
    { table: "festival_shifts", priority: "medium" },
    { table: "festival_shift_assignments", priority: "medium" },
    { table: "festival_gear_setups", priority: "medium" },
  ],
  festivalManagementArtists: [
    { table: "festivals", priority: "high" },
    { table: "festival_artists", priority: "high" },
    { table: "festival_forms", priority: "high" },
  ],
  festivalManagementGear: [
    { table: "festivals", priority: "high" },
    { table: "festival_gear", priority: "high" },
    { table: "festival_gear_setups", priority: "high" },
  ],
  festivalManagementScheduling: [
    { table: "festivals", priority: "high" },
    { table: "festival_shifts", priority: "high" },
    { table: "festival_shift_assignments", priority: "high" },
    { table: "profiles", priority: "medium" },
  ],
  pesosTool: [
    { table: "jobs", priority: "high" },
    { table: "video_memoria_tecnica_documents", priority: "high" },
  ],
  consumosTool: [
    { table: "jobs", priority: "high" },
    { table: "power_requirement_tables", priority: "high" },
  ],
  settings: [{ table: "profiles", priority: "medium" }],
  profile: [{ table: "profiles", priority: "high" }],
  hojaDeRuta: [
    { table: "jobs", priority: "high" },
    { table: "job_departments", priority: "medium" },
  ],
} as const satisfies Record<string, SubscriptionProfile>;

export type SubscriptionProfileId = keyof typeof subscriptionProfiles;

export const appRoutes: readonly AppRoute[] = [
  {
    id: "auth.root",
    path: "/",
    component: Auth,
    layout: "public",
    access: "public",
  },
  {
    id: "auth",
    path: "/auth",
    component: Auth,
    layout: "public",
    access: "public",
  },
  {
    id: "wallboard.public",
    path: "/wallboard/public/:token/:presetSlug?",
    component: WallboardPublic,
    layout: "public",
    access: "public",
  },
  {
    id: "tourShare",
    path: "/tour-share/:token",
    component: TourShare,
    layout: "public",
    access: "public",
  },
  {
    id: "privacy",
    path: "/privacy",
    component: Privacy,
    layout: "public",
    access: "public",
    breadcrumb: { label: "Privacidad" },
  },
  {
    id: "festival.artistForm.blank",
    path: "/festival/artist-form/blank",
    component: ArtistRequirementsFormBlank,
    layout: "public",
    access: "public",
  },
  {
    id: "festival.artistForm",
    path: "/festival/artist-form/:token",
    component: ArtistRequirementsForm,
    layout: "public",
    access: "public",
  },
  {
    id: "festival.formSubmitted",
    path: "/festival/form-submitted",
    component: FormSubmitted,
    layout: "public",
    access: "public",
  },
  {
    id: "wallboard",
    path: "/wallboard/:presetSlug?",
    component: Wallboard,
    layout: "fullscreen",
    access: "authenticated",
    chrome: { suppress: true },
    breadcrumb: { label: "Wallboard" },
  },
  {
    id: "techApp",
    path: "/tech-app",
    component: TechnicianSuperApp,
    layout: "fullscreen",
    access: "technicianApp",
    breadcrumb: { label: "App técnico" },
    nav: {
      id: "tech-app",
      label: "Panel técnico",
      mobileLabel: "Panel",
      shortcut: { id: "nav-tech-app", icon: "Smartphone" },
    },
  },
  {
    id: "achievements",
    path: "/achievements",
    component: Achievements,
    layout: "fullscreen",
    access: "authenticated",
    breadcrumb: { label: "Logros" },
  },
  {
    id: "sound",
    path: "/sound",
    component: Sound,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/sound",
    chrome: { mobileFullscreen: true },
    breadcrumb: { label: "Sonido" },
    nav: {
      id: "admin-sound",
      label: "Sonido",
      mobileLabel: "Sonido",
      shortcut: { id: "nav-sound", keybind: "Ctrl+2", icon: "Volume2" },
    },
  },
  {
    id: "personal",
    path: "/personal",
    component: Personal,
    layout: "app",
    access: "personal",
    breadcrumb: { label: "Agenda personal" },
    nav: {
      id: "personal",
      label: "Agenda personal",
      mobileLabel: "Agenda",
      shortcut: { id: "nav-personal", keybind: "Ctrl+8", icon: "Users" },
    },
  },
  {
    id: "dashboard",
    path: "/dashboard",
    component: Dashboard,
    layout: "app",
    access: "dashboard",
    subscriptions: "dashboard",
    breadcrumb: { label: "Panel principal" },
    nav: {
      id: "management-dashboard",
      label: "Panel principal",
      mobileLabel: "Panel",
      shortcut: { id: "nav-dashboard", keybind: "Ctrl+1", icon: "LayoutDashboard" },
    },
  },
  {
    id: "technicianDashboard",
    path: "/technician-dashboard",
    component: TechnicianDashboard,
    layout: "app",
    access: "technicianDashboard",
    subscriptions: "technicianDashboard",
    breadcrumb: { label: "Panel técnico" },
    nav: {
      id: "technician-dashboard",
      label: "Panel técnico",
      mobileLabel: "Panel",
      shortcut: { id: "nav-technician-dashboard", keybind: "Ctrl+Shift+1", icon: "Wrench" },
    },
  },
  {
    id: "technicianUnavailability",
    path: "/dashboard/unavailability",
    component: TechnicianUnavailability,
    layout: "app",
    access: "technicianUnavailability",
    breadcrumb: { label: "Mi disponibilidad", parentPath: "/technician-dashboard" },
  },
  {
    id: "morningSummary",
    path: "/morning-summary",
    component: MorningSummary,
    layout: "app",
    access: "authenticated",
    breadcrumb: { label: "Resumen de mañana" },
  },
  {
    id: "lights",
    path: "/lights",
    component: Lights,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/lights",
    breadcrumb: { label: "Luces" },
    nav: {
      id: "admin-lights",
      label: "Luces",
      mobileLabel: "Luces",
      shortcut: { id: "nav-lights", keybind: "Ctrl+3", icon: "Lightbulb" },
    },
  },
  {
    id: "video",
    path: "/video",
    component: Video,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/video",
    breadcrumb: { label: "Vídeo" },
    nav: {
      id: "admin-video",
      label: "Vídeo",
      mobileLabel: "Vídeo",
      shortcut: { id: "nav-video", keybind: "Ctrl+4", icon: "Video" },
    },
  },
  {
    id: "logistics",
    path: "/logistics",
    component: Logistics,
    layout: "app",
    access: "projectAndHouseTech",
    subscriptions: "logistics",
    breadcrumb: { label: "Logística" },
    nav: {
      id: "logistics",
      label: "Logística",
      mobileLabel: "Logística",
      shortcut: { id: "nav-logistics", keybind: "Ctrl+5", icon: "Truck" },
    },
  },
  {
    id: "profile",
    path: "/profile",
    component: Profile,
    layout: "app",
    access: "authenticated",
    subscriptions: "profile",
    breadcrumb: { label: "Perfil" },
    nav: {
      id: "profile",
      label: "Perfil",
      mobileLabel: "Perfil",
      shortcut: { id: "nav-profile", keybind: "Ctrl+Shift+P", icon: "User" },
    },
  },
  {
    id: "settings",
    path: "/settings",
    component: Settings,
    layout: "app",
    access: "management",
    subscriptions: "settings",
    breadcrumb: { label: "Ajustes" },
    nav: {
      id: "settings",
      label: "Ajustes",
      mobileLabel: "Ajustes",
      shortcut: { id: "nav-settings", keybind: "Ctrl+,", icon: "Settings" },
    },
  },
  {
    id: "projectManagement",
    path: "/project-management",
    component: ProjectManagement,
    layout: "app",
    access: "projectOperations",
    subscriptions: "projectManagement",
    breadcrumb: { label: "Gestión de proyectos" },
    nav: {
      id: "project-management",
      label: "Gestión de proyectos",
      mobileLabel: "Proyectos",
      shortcut: { id: "nav-project-management", keybind: "Ctrl+9", icon: "FolderKanban" },
    },
  },
  {
    id: "tasks",
    path: "/tasks",
    component: GlobalTasks,
    layout: "app",
    access: "tasks",
    breadcrumb: { label: "Tareas" },
  },
  {
    id: "equipmentManagement",
    path: "/equipment-management",
    component: EquipmentManagement,
    layout: "app",
    access: "authenticated",
    breadcrumb: { label: "Equipamiento" },
  },
  {
    id: "jobAssignmentMatrix",
    path: "/job-assignment-matrix",
    component: JobAssignmentMatrix,
    layout: "app",
    access: "management",
    breadcrumb: { label: "Matriz de asignaciones" },
    nav: {
      id: "job-assignment-matrix",
      label: "Matriz de asignaciones",
      mobileLabel: "Matriz",
      shortcut: { id: "nav-job-assignment-matrix", keybind: "Ctrl+0", icon: "Calendar" },
    },
  },
  {
    id: "activity",
    path: "/activity",
    component: ActivityCenter,
    layout: "app",
    access: "adminOnly",
    breadcrumb: { label: "Actividad" },
  },
  {
    id: "timesheets",
    path: "/timesheets",
    component: Timesheets,
    layout: "app",
    access: "authenticated",
    breadcrumb: { label: "Hojas de tiempo" },
    nav: {
      id: "timesheets",
      label: "Hojas de Tiempo",
      shortcut: { id: "nav-timesheets", keybind: "Ctrl+Shift+T", icon: "Clock" },
    },
  },
  {
    id: "tours",
    path: "/tours",
    component: Tours,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "tours",
    breadcrumb: { label: "Giras" },
    nav: {
      id: "tours",
      label: "Giras",
      mobileLabel: "Giras",
      shortcut: { id: "nav-tours", keybind: "Ctrl+6", icon: "Plane" },
    },
  },
  {
    id: "festivals",
    path: "/festivals",
    component: Festivals,
    layout: "app",
    access: "festivals",
    subscriptions: "festivals",
    breadcrumb: { label: "Festivales" },
    nav: {
      id: "festivals",
      label: "Festivales",
      mobileLabel: "Festivales",
      shortcut: { id: "nav-festivals", keybind: "Ctrl+7", icon: "Music" },
    },
  },
  {
    id: "incidentReports",
    path: "/incident-reports",
    component: IncidentReports,
    layout: "app",
    access: "management",
    breadcrumb: { label: "Partes de incidencias" },
  },
  {
    id: "announcements",
    path: "/announcements",
    component: Announcements,
    layout: "app",
    access: "adminOnly",
    breadcrumb: { label: "Anuncios" },
  },
  {
    id: "wallboardPresets",
    path: "/management/wallboard-presets",
    component: WallboardPresets,
    layout: "app",
    access: "adminOnly",
    breadcrumb: { label: "Wallboard" },
  },
  {
    id: "rates",
    path: "/management/rates",
    component: RatesCenterPage,
    layout: "app",
    access: "management",
    subscriptions: "rates",
    breadcrumb: { label: "Tarifas y extras" },
    nav: {
      id: "management-rates",
      label: "Tarifas y extras",
      mobileLabel: "Tarifas",
      shortcut: { id: "nav-rates", keybind: "Ctrl+Shift+R", icon: "DollarSign" },
    },
  },
  {
    id: "payoutsDue",
    path: "/management/payouts-due",
    component: PayoutsDueFortnights,
    layout: "app",
    access: "payoutsDue",
    breadcrumb: { label: "Pagos quincena" },
  },
  {
    id: "expenses",
    path: "/gastos",
    component: ExpensesPage,
    layout: "app",
    access: "projectOperations",
    subscriptions: "expenses",
    breadcrumb: { label: "Gastos" },
    nav: {
      id: "expenses",
      label: "Gastos",
      mobileLabel: "Gastos",
      shortcut: { id: "nav-expenses", keybind: "Ctrl+Shift+G", icon: "Receipt" },
    },
  },
  {
    id: "feedback",
    path: "/feedback",
    component: Feedback,
    layout: "app",
    access: "authenticated",
    breadcrumb: { label: "Comentarios y soporte" },
  },
  {
    id: "soundVisionFiles",
    path: "/soundvision-files",
    component: SoundVisionFiles,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Archivos de SoundVision" },
  },
  {
    id: "manual",
    path: "/manual",
    component: UserManual,
    layout: "app",
    access: "authenticated",
    breadcrumb: { label: "Manual" },
  },
  {
    id: "tourManagement",
    path: "/tour-management/:tourId",
    component: TourManagementWrapper,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "tourManagement",
    subscriptionRouteKey: "/tour-management",
    breadcrumb: { label: "Gestión de gira", parentPath: "/tours" },
  },
  {
    id: "soundPesos",
    path: "/sound/pesos",
    component: PesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/sound",
    chrome: { mobileFullscreen: true },
    breadcrumb: { label: "Pesos", parentPath: "/sound" },
  },
  {
    id: "soundConsumos",
    path: "/sound/consumos",
    component: ConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/sound",
    chrome: { mobileFullscreen: true },
    breadcrumb: { label: "Consumos", parentPath: "/sound" },
  },
  {
    id: "pesosTool",
    path: "/pesos-tool",
    component: PesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "pesosTool",
    breadcrumb: { label: "Pesos" },
  },
  {
    id: "lightsPesosTool",
    path: "/lights-pesos-tool",
    component: LightsPesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/lights",
    breadcrumb: { label: "Pesos luces" },
  },
  {
    id: "videoPesosTool",
    path: "/video-pesos-tool",
    component: VideoPesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/video",
    breadcrumb: { label: "Pesos vídeo" },
  },
  {
    id: "consumosTool",
    path: "/consumos-tool",
    component: ConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "consumosTool",
    breadcrumb: { label: "Consumos" },
  },
  {
    id: "lightsConsumosTool",
    path: "/lights-consumos-tool",
    component: LightsConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/lights",
    breadcrumb: { label: "Consumos luces" },
  },
  {
    id: "stagePlot",
    path: "/stage-plot",
    component: StagePlot,
    layout: "app",
    access: "soundTools",
    breadcrumb: { label: "Plano de escenario" },
  },
  {
    id: "sysCalc",
    path: "/syscalc",
    component: SysCalc,
    layout: "app",
    access: "soundToolsWithTechnician",
    breadcrumb: { label: "SysCalc" },
  },
  {
    id: "videoConsumosTool",
    path: "/video-consumos-tool",
    component: VideoConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "department",
    subscriptionRouteKey: "/video",
    breadcrumb: { label: "Consumos vídeo" },
  },
  {
    id: "lightsMemoriaTecnica",
    path: "/lights-memoria-tecnica",
    component: LightsMemoriaTecnica,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Memoria técnica luces" },
  },
  {
    id: "videoMemoriaTecnica",
    path: "/video-memoria-tecnica",
    component: VideoMemoriaTecnica,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Memoria técnica vídeo" },
  },
  {
    id: "hojaDeRuta",
    path: "/hoja-de-ruta",
    component: ModernHojaDeRuta,
    layout: "app",
    access: "management",
    subscriptions: "hojaDeRuta",
    breadcrumb: { label: "Hoja de ruta" },
    nav: {
      id: "hoja-de-ruta",
      label: "Hoja de Ruta",
      shortcut: { id: "nav-hoja-de-ruta", keybind: "Ctrl+Shift+H", icon: "Map" },
    },
  },
  {
    id: "tourSoundPesos",
    path: "/tours/:tourId/sound/pesos",
    component: PesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "tours",
    subscriptionRouteKey: "/tours",
    breadcrumb: { label: "Pesos", parentPath: "/tour-management/:tourId" },
  },
  {
    id: "tourSoundConsumos",
    path: "/tours/:tourId/sound/consumos",
    component: ConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "tours",
    subscriptionRouteKey: "/tours",
    breadcrumb: { label: "Consumos", parentPath: "/tour-management/:tourId" },
  },
  {
    id: "tourLightsPesos",
    path: "/tours/:tourId/lights/pesos",
    component: LightsPesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "tours",
    subscriptionRouteKey: "/tours",
    breadcrumb: { label: "Pesos luces", parentPath: "/tour-management/:tourId" },
  },
  {
    id: "tourLightsConsumos",
    path: "/tours/:tourId/lights/consumos",
    component: LightsConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "tours",
    subscriptionRouteKey: "/tours",
    breadcrumb: { label: "Consumos luces", parentPath: "/tour-management/:tourId" },
  },
  {
    id: "tourVideoPesos",
    path: "/tours/:tourId/video/pesos",
    component: VideoPesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "tours",
    subscriptionRouteKey: "/tours",
    breadcrumb: { label: "Pesos vídeo", parentPath: "/tour-management/:tourId" },
  },
  {
    id: "tourVideoConsumos",
    path: "/tours/:tourId/video/consumos",
    component: VideoConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "tours",
    subscriptionRouteKey: "/tours",
    breadcrumb: { label: "Consumos vídeo", parentPath: "/tour-management/:tourId" },
  },
  {
    id: "tourDateSoundPesos",
    path: "/tour-dates/:tourDateId/sound/pesos",
    component: PesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Pesos" },
  },
  {
    id: "tourDateSoundConsumos",
    path: "/tour-dates/:tourDateId/sound/consumos",
    component: ConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Consumos" },
  },
  {
    id: "tourDateLightsPesos",
    path: "/tour-dates/:tourDateId/lights/pesos",
    component: LightsPesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Pesos luces" },
  },
  {
    id: "tourDateLightsConsumos",
    path: "/tour-dates/:tourDateId/lights/consumos",
    component: LightsConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Consumos luces" },
  },
  {
    id: "tourDateVideoPesos",
    path: "/tour-dates/:tourDateId/video/pesos",
    component: VideoPesosTool,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Pesos vídeo" },
  },
  {
    id: "tourDateVideoConsumos",
    path: "/tour-dates/:tourDateId/video/consumos",
    component: VideoConsumosTool,
    layout: "app",
    access: "managementAndHouseTech",
    breadcrumb: { label: "Consumos vídeo" },
  },
  {
    id: "disponibilidad",
    path: "/disponibilidad",
    component: Disponibilidad,
    layout: "app",
    access: "disponibilidad",
    breadcrumb: { label: "Disponibilidad" },
  },
  {
    id: "festivalManagement",
    path: "/festival-management/:jobId",
    component: FestivalManagement,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "festivalManagement",
    subscriptionRouteKey: "/festival-management",
    breadcrumb: { label: "Festival", parentPath: "/festivals" },
  },
  {
    id: "festivalManagementArtists",
    path: "/festival-management/:jobId/artists",
    component: FestivalArtistManagement,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "festivalManagementArtists",
    subscriptionRouteKey: "/festival-management/artists",
    breadcrumb: { label: "Artistas", parentPath: "/festival-management/:jobId" },
  },
  {
    id: "festivalManagementGear",
    path: "/festival-management/:jobId/gear",
    component: FestivalGearManagement,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "festivalManagementGear",
    subscriptionRouteKey: "/festival-management/gear",
    breadcrumb: { label: "Equipamiento", parentPath: "/festival-management/:jobId" },
  },
  {
    id: "festivalManagementScheduling",
    path: "/festival-management/:jobId/scheduling",
    component: FestivalManagement,
    layout: "app",
    access: "managementAndHouseTech",
    subscriptions: "festivalManagementScheduling",
    subscriptionRouteKey: "/festival-management/scheduling",
    breadcrumb: { label: "Programación", parentPath: "/festival-management/:jobId" },
  },
];

export const publicRoutes = appRoutes.filter((route) => route.layout === "public");
export const fullscreenRoutes = appRoutes.filter((route) => route.layout === "fullscreen");
export const appShellRoutes = appRoutes.filter((route) => route.layout === "app");

export const createRouteElement = (route: AppRoute): React.ReactElement => {
  const Component = route.component;
  return accessPolicies[route.access].wrap(<Component />);
};

export const ROUTE_SUBSCRIPTIONS = Object.fromEntries(
  appRoutes.flatMap((route) => {
    if (!route.subscriptions) {
      return [];
    }

    return [
      [
        route.subscriptionRouteKey ?? route.path,
        subscriptionProfiles[route.subscriptions],
      ] as const,
    ];
  }),
) as Record<string, SubscriptionProfile>;

export const GLOBAL_SUBSCRIPTION_TABLES: SubscriptionProfile = [
  { table: "profiles", priority: "medium" },
];

export const routeNavigationConfigById = Object.fromEntries(
  appRoutes.flatMap((route) => {
    if (!route.nav) {
      return [];
    }

    return [[route.id, { ...route.nav, path: route.path, access: route.access }] as const];
  }),
) as Record<string, NavConfig & { path: string; access: AccessPolicyId }>;

export const routeNavigationConfigByNavId = Object.fromEntries(
  appRoutes.flatMap((route) => {
    if (!route.nav) {
      return [];
    }

    return [[route.nav.id, { ...route.nav, path: route.path, access: route.access }] as const];
  }),
) as Record<string, NavConfig & { path: string; access: AccessPolicyId }>;

export const navigationShortcuts = appRoutes.flatMap((route) => {
  if (!route.nav?.shortcut) {
    return [];
  }

  const policy = accessPolicies[route.access];
  return [
    {
      id: route.nav.shortcut.id,
      label: route.nav.label,
      route: route.path,
      keybind: route.nav.shortcut.keybind,
      icon: route.nav.shortcut.icon,
      access: route.access,
      requiredRoles: policy.allowedRoles ? [...policy.allowedRoles] : undefined,
      allowAssignableTech: policy.allowAssignableTech,
    },
  ];
});

export const matchAppRoute = (pathname: string): AppRoute | null =>
  appRoutes.find((route) => matchPath({ path: route.path, end: true }, pathname)) ?? null;

export const isPrivateAppPath = (pathname: string): boolean =>
  matchAppRoute(pathname)?.layout !== "public";

export const isPublicArtistFormPath = (pathname: string): boolean => {
  const routeId = matchAppRoute(pathname)?.id;
  return routeId === "festival.formSubmitted" ||
    routeId === "festival.artistForm.blank" ||
    routeId === "festival.artistForm";
};

export const shouldSuppressRouteChrome = (pathname: string): boolean =>
  matchAppRoute(pathname)?.chrome?.suppress === true;

export const isMobileFullscreenRoutePath = (pathname: string): boolean =>
  matchAppRoute(pathname)?.chrome?.mobileFullscreen === true;

export const getSubscriptionConfigForPathname = (
  pathname: string,
): { routeKey: string; tables: SubscriptionProfile } => {
  const route = matchAppRoute(pathname);

  if (!route?.subscriptions) {
    return { routeKey: pathname, tables: [] };
  }

  return {
    routeKey: route.subscriptionRouteKey ?? route.path,
    tables: subscriptionProfiles[route.subscriptions],
  };
};

// Substitute the dynamic params resolved from the active pathname into an
// ancestor route's path template (e.g. "/festival-management/:jobId" -> the
// concrete URL) so breadcrumb parent links actually navigate somewhere valid.
const resolveAncestorPath = (
  pathTemplate: string,
  params: Record<string, string | undefined>,
): string => {
  if (!pathTemplate.includes(":")) {
    return pathTemplate;
  }

  try {
    return generatePath(pathTemplate, params);
  } catch {
    // Missing param for this template — fall back to the raw template so the
    // crumb still renders (it just won't be a working link in that edge case).
    return pathTemplate;
  }
};

const MAX_BREADCRUMB_DEPTH = 10;

export const getBreadcrumbsForPathname = (
  pathname: string,
): Array<{ label: string; path: string }> => {
  const route = matchAppRoute(pathname);

  if (!route?.breadcrumb) {
    return [];
  }

  // Resolve the params for the active route once; ancestor templates reuse the
  // same param names (e.g. :jobId / :tourId) so they can be substituted too.
  const match = matchPath({ path: route.path, end: true }, pathname);
  const params = (match?.params ?? {}) as Record<string, string | undefined>;

  // Walk up the parentPath chain, building the trail from the current page
  // upward, then reverse so it reads root -> current.
  const reversed: Array<{ label: string; path: string }> = [
    { label: route.breadcrumb.label, path: pathname },
  ];

  let parentPath = route.breadcrumb.parentPath;
  const visited = new Set<string>([route.path]);

  while (parentPath && reversed.length < MAX_BREADCRUMB_DEPTH) {
    const parentRoute = appRoutes.find((candidate) => candidate.path === parentPath);

    if (!parentRoute || visited.has(parentRoute.path)) {
      // Unknown or cyclic parent — still emit a best-effort crumb and stop.
      reversed.push({
        label: parentRoute?.breadcrumb?.label ?? parentPath,
        path: resolveAncestorPath(parentPath, params),
      });
      break;
    }

    visited.add(parentRoute.path);
    reversed.push({
      label: parentRoute.breadcrumb?.label ?? parentPath,
      path: resolveAncestorPath(parentPath, params),
    });
    parentPath = parentRoute.breadcrumb?.parentPath;
  }

  return reversed.reverse();
};
