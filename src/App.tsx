
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { queryClient } from '@/lib/react-query';
import { MultiTabCoordinator } from '@/lib/multitab-coordinator';
import Layout from '@/components/layout/Layout';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import Sound from '@/pages/Sound';
import Lights from '@/pages/Lights';
import Video from '@/pages/Video';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import ProjectManagement from '@/pages/ProjectManagement';
import TechnicianDashboard from '@/pages/TechnicianDashboard';
import TechnicianUnavailability from '@/pages/TechnicianUnavailability';
import Personal from '@/pages/Personal';
import MorningSummary from '@/pages/MorningSummary';
import Tours from '@/pages/Tours';
import PesosTool from '@/pages/PesosTool';
import LightsPesosTool from '@/pages/LightsPesosTool';
import VideoPesosTool from '@/pages/VideoPesosTool';
import ConsumosTool from '@/pages/ConsumosTool';
import LightsConsumosTool from '@/pages/LightsConsumosTool';
import VideoConsumosTool from '@/pages/VideoConsumosTool';
import ExcelTool from '@/pages/ExcelTool';
import { ModernHojaDeRuta } from '@/components/hoja-de-ruta/ModernHojaDeRuta';
import LaborPOForm from '@/pages/LaborPOForm';
import Logistics from '@/pages/Logistics';
import FestivalManagement from '@/pages/FestivalManagement';
import FestivalArtistManagement from '@/pages/FestivalArtistManagement';
import LightsMemoriaTecnica from '@/pages/LightsMemoriaTecnica';
import VideoMemoriaTecnica from '@/pages/VideoMemoriaTecnica';
import Disponibilidad from '@/pages/Disponibilidad';
import JobAssignmentMatrix from '@/pages/JobAssignmentMatrix';
import ActivityCenter from '@/pages/ActivityCenter';
import { EquipmentManagement } from '@/pages/EquipmentManagement';
import { ArtistRequirementsForm } from '@/components/festival/ArtistRequirementsForm';
import { FormSubmitted } from '@/components/festival/FormSubmitted';
import { RequireAuth } from '@/components/RequireAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import FestivalGearManagement from '@/pages/FestivalGearManagement';
import Festivals from '@/pages/Festivals';
import { OptimizedAuthProvider, useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AppInit } from "@/components/AppInit";
import { TourManagementWrapper } from "@/components/tours/TourManagementWrapper";
import Timesheets from '@/pages/Timesheets';
import { UserManual } from '@/components/UserManual';
import IncidentReports from '@/pages/IncidentReports';
import Wallboard from '@/pages/Wallboard';
import WallboardPublic from '@/pages/WallboardPublic';
import Announcements from '@/pages/Announcements';
import WallboardPresets from '@/pages/WallboardPresets';
import RatesCenterPage from '@/pages/RatesCenterPage';
import { useActivityPushFallback } from '@/hooks/useActivityPushFallback';
import { AppBadgeProvider } from "@/providers/AppBadgeProvider";
import SoundVisionFiles from '@/pages/SoundVisionFiles';
import { ViewportProvider } from '@/hooks/use-mobile';
import PublicIncidentReport from '@/pages/PublicIncidentReport';

// Initialize activity push fallback within auth context
function ActivityPushFallbackInit() {
  useActivityPushFallback();
  return null;
}

const SOUND_DEPARTMENT = "sound";
const LIGHTS_DEPARTMENT = "lights";

const FestivalsAccessGuard = () => {
  const { userRole, userDepartment, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return null;
  }

  const isAdmin = userRole === "admin";
  const isSoundMember = userDepartment?.toLowerCase() === SOUND_DEPARTMENT;

  if (!isAdmin && !isSoundMember) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Festivals />;
};

const DisponibilidadAccessGuard = () => {
  const { userRole, userDepartment, isLoading } = useOptimizedAuth();

  if (isLoading) {
    return null;
  }

  const normalizedDepartment = userDepartment?.toLowerCase();
  const isAdmin = userRole === "admin";
  const hasManagementDepartmentAccess =
    userRole === "management" &&
    (normalizedDepartment === SOUND_DEPARTMENT ||
      normalizedDepartment === LIGHTS_DEPARTMENT);

  if (!isAdmin && !hasManagementDepartmentAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Disponibilidad />;
};

export default function App() {
  // Initialize multi-tab coordinator
  React.useEffect(() => {
    const coordinator = MultiTabCoordinator.getInstance(queryClient);
    
    return () => {
      coordinator.destroy();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ViewportProvider>
        <ThemeProvider defaultTheme="system" storageKey="sector-pro-theme">
          <SubscriptionProvider>
            <AppBadgeProvider>
              <Router>
                <OptimizedAuthProvider>
                  <AppInit />
                  <ActivityPushFallbackInit />
                  <div className="app">
                    <Routes>
                      <Route path="/" element={<Auth />} />
                      <Route path="/auth" element={<Auth />} />
                      {/* Wallboard: public tokenized access (no auth required) */}
                      <Route path="/wallboard/public/:token/:presetSlug?" element={<WallboardPublic />} />
                      {/* Wallboard: protected, full-screen (no Layout) */}
                      <Route path="/wallboard/:presetSlug?" element={<RequireAuth><Wallboard /></RequireAuth>} />
                      {/* Public Routes */}
                      <Route path="festival">
                        <Route path="artist-form/:token" element={<ArtistRequirementsForm />} />
                        <Route path="form-submitted" element={<FormSubmitted />} />
                      </Route>
                      <Route path="/public/incident/:equipmentId" element={<PublicIncidentReport />} />

                      {/* Protected Routes */}
                      <Route element={<RequireAuth><Layout /></RequireAuth>}>
                        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'management', 'logistics']}><Dashboard /></ProtectedRoute>} />
                        <Route path="/technician-dashboard" element={<ProtectedRoute allowedRoles={['technician', 'house_tech']}><TechnicianDashboard /></ProtectedRoute>} />
                        <Route path="/dashboard/unavailability" element={<ProtectedRoute allowedRoles={['technician', 'house_tech']}><TechnicianUnavailability /></ProtectedRoute>} />
                        <Route path="/personal" element={<ProtectedRoute allowedRoles={['admin', 'management', 'logistics', 'house_tech']}><Personal /></ProtectedRoute>} />
                        <Route path="/morning-summary" element={<MorningSummary />} />
                        <Route path="/sound" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><Sound /></ProtectedRoute>} />
                        <Route path="/lights" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><Lights /></ProtectedRoute>} />
                        <Route path="/video" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><Video /></ProtectedRoute>} />
                        <Route path="/logistics" element={<ProtectedRoute allowedRoles={['admin', 'management', 'logistics', 'house_tech']}><Logistics /></ProtectedRoute>} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'management']}><Settings /></ProtectedRoute>} />
                        <Route path="/project-management" element={<ProtectedRoute allowedRoles={['admin', 'management', 'logistics']}><ProjectManagement /></ProtectedRoute>} />
                        <Route path="/equipment-management" element={<EquipmentManagement />} />
                        <Route path="/job-assignment-matrix" element={<ProtectedRoute allowedRoles={['admin', 'management']}><JobAssignmentMatrix /></ProtectedRoute>} />
                        <Route path="/activity" element={<ProtectedRoute allowedRoles={['admin']}><ActivityCenter /></ProtectedRoute>} />
                        <Route path="/timesheets" element={<Timesheets />} />
                        <Route path="/tours" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><Tours /></ProtectedRoute>} />
                        <Route path="/festivals" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><FestivalsAccessGuard /></ProtectedRoute>} />
                        <Route path="/incident-reports" element={<ProtectedRoute allowedRoles={['admin', 'management']}><IncidentReports /></ProtectedRoute>} />
                        <Route path="/announcements" element={<ProtectedRoute allowedRoles={['admin']}><Announcements /></ProtectedRoute>} />
                        <Route path="/management/wallboard-presets" element={<ProtectedRoute allowedRoles={['admin']}><WallboardPresets /></ProtectedRoute>} />
                        <Route path="/management/rates" element={<ProtectedRoute allowedRoles={['admin', 'management']}><RatesCenterPage /></ProtectedRoute>} />
                        <Route path="/manual" element={<UserManual />} />

                        {/* Tour Management Route */}
                        <Route path="/tour-management/:tourId" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><TourManagementWrapper /></ProtectedRoute>} />

                        {/* Tools Routes - Both nested and original paths for compatibility */}
                        <Route path="/sound/pesos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><PesosTool /></ProtectedRoute>} />
                        <Route path="/sound/consumos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><ConsumosTool /></ProtectedRoute>} />
                        <Route path="/pesos-tool" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><PesosTool /></ProtectedRoute>} />
                        <Route path="/lights-pesos-tool" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><LightsPesosTool /></ProtectedRoute>} />
                        <Route path="/video-pesos-tool" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><VideoPesosTool /></ProtectedRoute>} />
                        <Route path="/consumos-tool" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><ConsumosTool /></ProtectedRoute>} />
                        <Route path="/lights-consumos-tool" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><LightsConsumosTool /></ProtectedRoute>} />
                        <Route path="/video-consumos-tool" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><VideoConsumosTool /></ProtectedRoute>} />
                        <Route path="/lights-memoria-tecnica" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><LightsMemoriaTecnica /></ProtectedRoute>} />
                        <Route path="/video-memoria-tecnica" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><VideoMemoriaTecnica /></ProtectedRoute>} />
                        <Route path="/excel-tool" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><ExcelTool /></ProtectedRoute>} />
                        <Route path="/hoja-de-ruta" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><ModernHojaDeRuta /></ProtectedRoute>} />
                        <Route path="/labor-po-form" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><LaborPOForm /></ProtectedRoute>} />

                        {/* Tour-specific tool routes */}
                        <Route path="/tours/:tourId/sound/pesos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><PesosTool /></ProtectedRoute>} />
                        <Route path="/tours/:tourId/sound/consumos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><ConsumosTool /></ProtectedRoute>} />
                        <Route path="/tours/:tourId/lights/pesos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><LightsPesosTool /></ProtectedRoute>} />
                        <Route path="/tours/:tourId/lights/consumos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><LightsConsumosTool /></ProtectedRoute>} />
                        <Route path="/tours/:tourId/video/pesos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><VideoPesosTool /></ProtectedRoute>} />
                        <Route path="/tours/:tourId/video/consumos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><VideoConsumosTool /></ProtectedRoute>} />

                        {/* Tour date-specific tool routes */}
                        <Route path="/tour-dates/:tourDateId/sound/pesos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><PesosTool /></ProtectedRoute>} />
                        <Route path="/tour-dates/:tourDateId/sound/consumos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><ConsumosTool /></ProtectedRoute>} />
                        <Route path="/tour-dates/:tourDateId/lights/pesos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><LightsPesosTool /></ProtectedRoute>} />
                        <Route path="/tour-dates/:tourDateId/lights/consumos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><LightsConsumosTool /></ProtectedRoute>} />
                        <Route path="/tour-dates/:tourDateId/video/pesos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><VideoPesosTool /></ProtectedRoute>} />
                        <Route path="/tour-dates/:tourDateId/video/consumos" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><VideoConsumosTool /></ProtectedRoute>} />

                        {/* Disponibilidad Route */}
                        <Route path="/disponibilidad" element={<ProtectedRoute allowedRoles={['admin', 'management']}><DisponibilidadAccessGuard /></ProtectedRoute>} />

                        {/* SoundVision Files Route */}
                        <Route path="/soundvision-files" element={<SoundVisionFiles />} />

                        {/* Festival Management Routes */}
                        <Route path="/festival-management/:jobId" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><FestivalManagement /></ProtectedRoute>} />
                        <Route path="/festival-management/:jobId/artists" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><FestivalArtistManagement /></ProtectedRoute>} />
                        <Route path="/festival-management/:jobId/gear" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><FestivalGearManagement /></ProtectedRoute>} />
                        <Route path="/festival-management/:jobId/scheduling" element={<ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}><FestivalManagement /></ProtectedRoute>} />
                      </Route>
                    </Routes>
                    {/* Radix-based toaster (legacy) and Sonner toaster for activity + app toasts */}
                    <Toaster />
                    <SonnerToaster richColors position="top-right" />
                  </div>
                </OptimizedAuthProvider>
              </Router>
            </AppBadgeProvider>
          </SubscriptionProvider>
        </ThemeProvider>
      </ViewportProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
