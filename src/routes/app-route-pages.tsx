/* eslint-disable react-refresh/only-export-components */
import React, { lazy } from "react";

type RouteComponent = React.LazyExoticComponent<React.ComponentType<Record<string, never>>>;

export const lazyPage = (importer: () => Promise<{ default: React.ComponentType<Record<string, never>> }>): RouteComponent =>
  lazy(importer);

export const Auth = lazyPage(() => import("@/pages/Auth"));
export const Dashboard = lazyPage(() => import("@/pages/Dashboard"));
export const Sound = lazyPage(() => import("@/pages/Sound"));
export const Lights = lazyPage(() => import("@/pages/Lights"));
export const Video = lazyPage(() => import("@/pages/Video"));
export const Profile = lazyPage(() => import("@/pages/Profile"));
export const Settings = lazyPage(() => import("@/pages/Settings"));
export const ProjectManagement = lazyPage(() => import("@/pages/ProjectManagement"));
export const TechnicianDashboard = lazyPage(() => import("@/pages/TechnicianDashboard"));
export const TechnicianUnavailability = lazyPage(() => import("@/pages/TechnicianUnavailability"));
export const TechnicianSuperApp = lazyPage(() => import("@/pages/TechnicianSuperApp"));
export const Personal = lazyPage(() => import("@/pages/Personal"));
export const MorningSummary = lazyPage(() => import("@/pages/MorningSummary"));
export const Tours = lazyPage(() => import("@/pages/Tours"));
export const PesosTool = lazyPage(() => import("@/pages/PesosTool"));
export const LightsPesosTool = lazyPage(() => import("@/pages/LightsPesosTool"));
export const VideoPesosTool = lazyPage(() => import("@/pages/VideoPesosTool"));
export const ConsumosTool = lazyPage(() => import("@/pages/ConsumosTool"));
export const LightsConsumosTool = lazyPage(() => import("@/pages/LightsConsumosTool"));
export const VideoConsumosTool = lazyPage(() => import("@/pages/VideoConsumosTool"));
export const Logistics = lazyPage(() => import("@/pages/Logistics"));
export const FestivalManagement = lazyPage(() => import("@/pages/FestivalManagement"));
export const FestivalArtistManagement = lazyPage(() => import("@/pages/FestivalArtistManagement"));
export const LightsMemoriaTecnica = lazyPage(() => import("@/pages/LightsMemoriaTecnica"));
export const VideoMemoriaTecnica = lazyPage(() => import("@/pages/VideoMemoriaTecnica"));
export const Disponibilidad = lazyPage(() => import("@/pages/Disponibilidad"));
export const JobAssignmentMatrix = lazyPage(() => import("@/pages/JobAssignmentMatrix"));
export const ActivityCenter = lazyPage(() => import("@/pages/ActivityCenter"));
export const FestivalGearManagement = lazyPage(() => import("@/pages/FestivalGearManagement"));
export const Festivals = lazyPage(() => import("@/pages/Festivals"));
export const Timesheets = lazyPage(() => import("@/pages/Timesheets"));
export const IncidentReports = lazyPage(() => import("@/pages/IncidentReports"));
export const Wallboard = lazyPage(() => import("@/pages/Wallboard"));
export const WallboardPublic = lazyPage(() => import("@/pages/WallboardPublic"));
export const TourShare = lazyPage(() => import("@/pages/TourShare"));
export const Announcements = lazyPage(() => import("@/pages/Announcements"));
export const WallboardPresets = lazyPage(() => import("@/pages/WallboardPresets"));
export const RatesCenterPage = lazyPage(() => import("@/pages/RatesCenterPage"));
export const PayoutsDueFortnights = lazyPage(() => import("@/pages/PayoutsDueFortnights"));
export const ExpensesPage = lazyPage(() => import("@/pages/Expenses"));
export const Feedback = lazyPage(() => import("@/pages/Feedback"));
export const SoundVisionFiles = lazyPage(() => import("@/pages/SoundVisionFiles"));
export const Privacy = lazyPage(() => import("@/pages/Privacy"));
export const StagePlot = lazyPage(() => import("@/pages/StagePlot"));
export const SysCalc = lazyPage(() => import("@/pages/SysCalc"));
export const RackBuilderProjectManagerPage = lazyPage(() => import("@/pages/rack-builder/ProjectManagerPage"));
export const RackBuilderRackManagerPage = lazyPage(() => import("@/pages/rack-builder/RackManagerPage"));
export const RackBuilderDeviceManagerPage = lazyPage(() => import("@/pages/rack-builder/DeviceManagerPage"));
export const RackBuilderConnectorManagerPage = lazyPage(() => import("@/pages/rack-builder/ConnectorManagerPage"));
export const RackBuilderPanelLayoutsOverviewPage = lazyPage(() => import("@/pages/rack-builder/PanelLayoutsOverviewPage"));
export const RackBuilderLayoutEditorPage = lazyPage(() => import("@/pages/rack-builder/LayoutEditorPage"));
export const RackBuilderPanelLayoutManagerPage = lazyPage(() => import("@/pages/rack-builder/PanelLayoutManagerPage"));
export const RackBuilderPanelLayoutEditorPage = lazyPage(() => import("@/pages/rack-builder/PanelLayoutEditorPage"));
export const RackBuilderPanelLayoutPrintPage = lazyPage(() => import("@/pages/rack-builder/PanelLayoutPrintPage"));
export const RackBuilderProjectPrintPage = lazyPage(() => import("@/pages/rack-builder/ProjectPrintPage"));
export const RackBuilderLayoutPrintPage = lazyPage(() => import("@/pages/rack-builder/LayoutPrintPage"));
export const GlobalTasks = lazyPage(() => import("@/pages/GlobalTasks"));
export const Achievements = lazyPage(() => import("@/pages/Achievements"));

export const ModernHojaDeRuta = lazy(() =>
  import("@/components/hoja-de-ruta/ModernHojaDeRuta").then((module) => ({
    default: module.ModernHojaDeRuta as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

export const EquipmentManagement = lazy(() =>
  import("@/pages/EquipmentManagement").then((module) => ({
    default: module.EquipmentManagement as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

export const ArtistRequirementsForm = lazy(() =>
  import("@/components/festival/ArtistRequirementsForm").then((module) => ({
    default: module.ArtistRequirementsForm as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

export const ArtistRequirementsFormBlank = lazy(() =>
  import("@/components/festival/ArtistRequirementsForm").then((module) => ({
    default: function BlankArtistRequirementsForm() {
      return <module.ArtistRequirementsForm isBlank />;
    },
  })),
) as RouteComponent;

export const FormSubmitted = lazy(() =>
  import("@/components/festival/FormSubmitted").then((module) => ({
    default: module.FormSubmitted as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

export const TourManagementWrapper = lazy(() =>
  import("@/components/tours/TourManagementWrapper").then((module) => ({
    default: module.TourManagementWrapper as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;

export const UserManual = lazy(() =>
  import("@/components/UserManual").then((module) => ({
    default: module.UserManual as React.ComponentType<Record<string, never>>,
  })),
) as RouteComponent;
