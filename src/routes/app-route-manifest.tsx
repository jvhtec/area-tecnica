import React from "react";
import { Navigate, generatePath, matchPath } from "react-router-dom";

import { primaryAppRoutes } from "@/routes/app-route-primary-routes";
import { secondaryAppRoutes } from "@/routes/app-route-secondary-routes";
import type {
  AccessPolicyId,
  AppRoute,
  NavConfig,
  SubscriptionProfile,
  SubscriptionProfileId,
} from "@/routes/app-route-types";

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
  isManagementRole,
} from "@/utils/permissions";

export type {
  AccessPolicyId,
  AppRoute,
  BreadcrumbConfig,
  LayoutKind,
  NavConfig,
  RouteComponent,
  SubscriptionPriority,
  SubscriptionProfile,
  SubscriptionProfileId,
  SubscriptionTableRequirement,
} from "@/routes/app-route-types";

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
const RACK_BUILDER_DEPARTMENTS = new Set(["sound", "lights", "admin", "management"]);
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

// Mirrors the rack_builder_* RLS boundary: sound/lights departments plus
// management/admin. A house_tech in another department should not land on
// pages that RLS then renders empty/broken for them.
const RackBuilderDepartmentGuard = ({ children }: { children: React.ReactNode }) => {
  const { userRole, userDepartment, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return <RedirectingAccessLoader />;
  }

  const isManagement = isManagementRole(userRole);
  const isRackBuilderDepartmentMember = RACK_BUILDER_DEPARTMENTS.has(userDepartment?.toLowerCase() ?? "");

  if (!isManagement && !isRackBuilderDepartmentMember) {
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
  rackBuilder: withRoleAccess(SOUND_TOOL_ROLES, { guard: RackBuilderDepartmentGuard }),
} as const satisfies Record<AccessPolicyId, RouteAccessPolicy>;


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
} as const satisfies Record<SubscriptionProfileId, SubscriptionProfile>;

export const appRoutes: readonly AppRoute[] = [...primaryAppRoutes, ...secondaryAppRoutes];

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
