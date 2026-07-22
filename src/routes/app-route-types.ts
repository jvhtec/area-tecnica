import type { ComponentType, LazyExoticComponent } from "react";

export type RouteComponent = LazyExoticComponent<
  ComponentType<Record<string, never>>
>;
export type LayoutKind = "public" | "fullscreen" | "app";
export type SubscriptionPriority = "high" | "medium" | "low";

export type SubscriptionTableRequirement = {
  table: string;
  priority: SubscriptionPriority;
};

export type SubscriptionProfile = readonly SubscriptionTableRequirement[];

export type AccessPolicyId =
  | "public"
  | "authenticated"
  | "adminOnly"
  | "dashboard"
  | "management"
  | "managementAndHouseTech"
  | "personal"
  | "projectOperations"
  | "projectAndHouseTech"
  | "tasks"
  | "technicianApp"
  | "technicianDashboard"
  | "technicianUnavailability"
  | "festivals"
  | "disponibilidad"
  | "payoutsDue"
  | "soundTools"
  | "soundToolsWithTechnician"
  | "rackBuilder";

export type SubscriptionProfileId =
  | "dashboard"
  | "department"
  | "technicianDashboard"
  | "logistics"
  | "tours"
  | "tourManagement"
  | "projectManagement"
  | "rates"
  | "expenses"
  | "festivals"
  | "festivalManagement"
  | "festivalManagementArtists"
  | "festivalManagementGear"
  | "festivalManagementScheduling"
  | "pesosTool"
  | "consumosTool"
  | "settings"
  | "profile"
  | "hojaDeRuta";

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
