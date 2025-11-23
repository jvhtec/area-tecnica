
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { queryClient } from '@/lib/react-query';
import { MultiTabCoordinator } from '@/lib/multitab-coordinator';
import Layout from '@/components/layout/Layout';
import { RequireAuth } from '@/components/RequireAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { OptimizedAuthProvider, useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AppInit } from "@/components/AppInit";
import { useActivityPushFallback } from '@/hooks/useActivityPushFallback';
import { AppBadgeProvider } from "@/providers/AppBadgeProvider";
import { ViewportProvider } from '@/hooks/use-mobile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Lazy load all pages for better initial bundle size
const Auth = lazy(() => import('@/pages/Auth'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Sound = lazy(() => import('@/pages/Sound'));
const Lights = lazy(() => import('@/pages/Lights'));
const Video = lazy(() => import('@/pages/Video'));
const Profile = lazy(() => import('@/pages/Profile'));
const Settings = lazy(() => import('@/pages/Settings'));
const ProjectManagement = lazy(() => import('@/pages/ProjectManagement'));
const TechnicianDashboard = lazy(() => import('@/pages/TechnicianDashboard'));
const TechnicianUnavailability = lazy(() => import('@/pages/TechnicianUnavailability'));
const TechnicianSuperApp = lazy(() => import('@/pages/TechnicianSuperApp'));
const Personal = lazy(() => import('@/pages/Personal'));
const MorningSummary = lazy(() => import('@/pages/MorningSummary'));
const Tours = lazy(() => import('@/pages/Tours'));
const PesosTool = lazy(() => import('@/pages/PesosTool'));
const LightsPesosTool = lazy(() => import('@/pages/LightsPesosTool'));
const VideoPesosTool = lazy(() => import('@/pages/VideoPesosTool'));
const ConsumosTool = lazy(() => import('@/pages/ConsumosTool'));
const LightsConsumosTool = lazy(() => import('@/pages/LightsConsumosTool'));
const VideoConsumosTool = lazy(() => import('@/pages/VideoConsumosTool'));
const ExcelTool = lazy(() => import('@/pages/ExcelTool'));
const ModernHojaDeRuta = lazy(() => import('@/components/hoja-de-ruta/ModernHojaDeRuta').then(m => ({ default: m.ModernHojaDeRuta })));
const LaborPOForm = lazy(() => import('@/pages/LaborPOForm'));
const Logistics = lazy(() => import('@/pages/Logistics'));
const FestivalManagement = lazy(() => import('@/pages/FestivalManagement'));
const FestivalArtistManagement = lazy(() => import('@/pages/FestivalArtistManagement'));
const LightsMemoriaTecnica = lazy(() => import('@/pages/LightsMemoriaTecnica'));
const VideoMemoriaTecnica = lazy(() => import('@/pages/VideoMemoriaTecnica'));
const Disponibilidad = lazy(() => import('@/pages/Disponibilidad'));
const JobAssignmentMatrix = lazy(() => import('@/pages/JobAssignmentMatrix'));
const ActivityCenter = lazy(() => import('@/pages/ActivityCenter'));
const EquipmentManagement = lazy(() => import('@/pages/EquipmentManagement').then(m => ({ default: m.EquipmentManagement })));
const ArtistRequirementsForm = lazy(() => import('@/components/festival/ArtistRequirementsForm').then(m => ({ default: m.ArtistRequirementsForm })));
const FormSubmitted = lazy(() => import('@/components/festival/FormSubmitted').then(m => ({ default: m.FormSubmitted })));
const FestivalGearManagement = lazy(() => import('@/pages/FestivalGearManagement'));
const Festivals = lazy(() => import('@/pages/Festivals'));
const TourManagementWrapper = lazy(() => import('@/components/tours/TourManagementWrapper').then(m => ({ default: m.TourManagementWrapper })));
const Timesheets = lazy(() => import('@/pages/Timesheets'));
const UserManual = lazy(() => import('@/components/UserManual').then(m => ({ default: m.UserManual })));
const IncidentReports = lazy(() => import('@/pages/IncidentReports'));
const Wallboard = lazy(() => import('@/pages/Wallboard'));
const WallboardPublic = lazy(() => import('@/pages/WallboardPublic'));
const Announcements = lazy(() => import('@/pages/Announcements'));
const WallboardPresets = lazy(() => import('@/pages/WallboardPresets'));
const RatesCenterPage = lazy(() => import('@/pages/RatesCenterPage'));
const SoundVisionFiles = lazy(() => import('@/pages/SoundVisionFiles'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

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
    <ErrorBoundary>
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
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/" element={<Auth />} />
                          <Route path="/auth" element={<Auth />} />
                          {/* Wallboard: public tokenized access (no auth required) */}
                          <Route path="/wallboard/public/:token/:presetSlug?" element={<WallboardPublic />} />
                          {/* Wallboard: protected, full-screen (no Layout) */}
                          <Route path="/wallboard/:presetSlug?" element={<RequireAuth><Wallboard /></RequireAuth>} />
                          {/* TechnicianSuperApp: full-screen mobile interface for technicians */}
                          <Route path="/tech-app" element={<RequireAuth><ProtectedRoute allowedRoles={['technician', 'house_tech']}><TechnicianSuperApp /></ProtectedRoute></RequireAuth>} />

                          {/* Routes outside Layout wrapper - full screen */}
                          <Route
                            path="/personal"
                            element={
                              <RequireAuth>
                                <ProtectedRoute allowedRoles={['admin', 'management', 'logistics', 'house_tech']}>
                                  <Personal />
                                </ProtectedRoute>
                              </RequireAuth>
                            }
                          />
                          <Route
                            path="/sound"
                            element={
                              <RequireAuth>
                                <ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}>
                                  <Sound />
                                </ProtectedRoute>
                              </RequireAuth>
                            }
                          />

                          {/* Public Routes */}
                          <Route path="festival">
                            <Route path="artist-form/:token" element={<ArtistRequirementsForm />} />
                            <Route path="form-submitted" element={<FormSubmitted />} />
                          </Route>

                          {/* Protected Routes */}
                          <Route element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'management', 'logistics']}><Dashboard /></ProtectedRoute>} />
                            <Route path="/technician-dashboard" element={<ProtectedRoute allowedRoles={['technician', 'house_tech']}><TechnicianDashboard /></ProtectedRoute>} />
                            <Route path="/dashboard/unavailability" element={<ProtectedRoute allowedRoles={['technician', 'house_tech']}><TechnicianUnavailability /></ProtectedRoute>} />
                            <Route path="/morning-summary" element={<MorningSummary />} />
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
                      </Suspense>
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
    </ErrorBoundary>
  );
}
