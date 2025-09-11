
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
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
import Personal from '@/pages/Personal';
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
import LightsDisponibilidad from '@/pages/LightsDisponibilidad';
import LightsMemoriaTecnica from '@/pages/LightsMemoriaTecnica';
import VideoMemoriaTecnica from '@/pages/VideoMemoriaTecnica';
import JobAssignmentMatrix from '@/pages/JobAssignmentMatrix';
import { EquipmentManagement } from '@/pages/EquipmentManagement';
import { ArtistRequirementsForm } from '@/components/festival/ArtistRequirementsForm';
import { FormSubmitted } from '@/components/festival/FormSubmitted';
import FestivalGearManagement from '@/pages/FestivalGearManagement';
import Festivals from '@/pages/Festivals';
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AppInit } from "@/components/AppInit";
import { TourManagementWrapper } from "@/components/tours/TourManagementWrapper";
import Timesheets from '@/pages/Timesheets';
import JobManagement from '@/pages/JobManagement';
import { UserManual } from '@/components/UserManual';

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
      <ThemeProvider defaultTheme="system" storageKey="sector-pro-theme">
        <SubscriptionProvider>
          <Router>
            <AuthProvider>
              <AppInit />
              <div className="app">
                <Routes>
                  <Route path="/" element={<Auth />} />
                  <Route path="/auth" element={<Auth />} />
                  {/* Public Routes */}
                  <Route path="festival">
                    <Route path="artist-form/:token" element={<ArtistRequirementsForm />} />
                    <Route path="form-submitted" element={<FormSubmitted />} />
                  </Route>
                  
                  {/* Protected Routes */}
                  <Route element={<Layout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/technician-dashboard" element={<TechnicianDashboard />} />
                    <Route path="/personal" element={<Personal />} />
                    <Route path="/sound" element={<Sound />} />
                    <Route path="/lights" element={<Lights />} />
                    <Route path="/video" element={<Video />} />
                    <Route path="/logistics" element={<Logistics />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/project-management" element={<ProjectManagement />} />
                    <Route path="/equipment-management" element={<EquipmentManagement />} />
                    <Route path="/job-assignment-matrix" element={<JobAssignmentMatrix />} />
                    <Route path="/timesheets" element={<Timesheets />} />
                    <Route path="/tours" element={<Tours />} />
                    <Route path="/festivals" element={<Festivals />} />
                    <Route path="/manual" element={<UserManual />} />
                    
                    {/* Tour Management Route */}
                    <Route path="/tour-management/:tourId" element={<TourManagementWrapper />} />
                    
                    {/* Tools Routes - Both nested and original paths for compatibility */}
                    <Route path="/sound/pesos" element={<PesosTool />} />
                    <Route path="/sound/consumos" element={<ConsumosTool />} />
                    <Route path="/pesos-tool" element={<PesosTool />} />
                    <Route path="/lights-pesos-tool" element={<LightsPesosTool />} />
                    <Route path="/video-pesos-tool" element={<VideoPesosTool />} />
                    <Route path="/consumos-tool" element={<ConsumosTool />} />
                    <Route path="/lights-consumos-tool" element={<LightsConsumosTool />} />
                    <Route path="/video-consumos-tool" element={<VideoConsumosTool />} />
                    <Route path="/lights-memoria-tecnica" element={<LightsMemoriaTecnica />} />
                    <Route path="/video-memoria-tecnica" element={<VideoMemoriaTecnica />} />
                    <Route path="/excel-tool" element={<ExcelTool />} />
                    <Route path="/hoja-de-ruta" element={<ModernHojaDeRuta />} />
                    <Route path="/labor-po-form" element={<LaborPOForm />} />
                    
                    {/* Tour-specific tool routes */}
                    <Route path="/tours/:tourId/sound/pesos" element={<PesosTool />} />
                    <Route path="/tours/:tourId/sound/consumos" element={<ConsumosTool />} />
                    <Route path="/tours/:tourId/lights/pesos" element={<LightsPesosTool />} />
                    <Route path="/tours/:tourId/lights/consumos" element={<LightsConsumosTool />} />
                    <Route path="/tours/:tourId/video/pesos" element={<VideoPesosTool />} />
                    <Route path="/tours/:tourId/video/consumos" element={<VideoConsumosTool />} />
                    
                    {/* Tour date-specific tool routes */}
                    <Route path="/tour-dates/:tourDateId/sound/pesos" element={<PesosTool />} />
                    <Route path="/tour-dates/:tourDateId/sound/consumos" element={<ConsumosTool />} />
                    <Route path="/tour-dates/:tourDateId/lights/pesos" element={<LightsPesosTool />} />
                    <Route path="/tour-dates/:tourDateId/lights/consumos" element={<LightsConsumosTool />} />
                    <Route path="/tour-dates/:tourDateId/video/pesos" element={<VideoPesosTool />} />
                    <Route path="/tour-dates/:tourDateId/video/consumos" element={<VideoConsumosTool />} />
                    
                    {/* Disponibilidad Routes */}
                    <Route path="/lights-disponibilidad" element={<LightsDisponibilidad />} />
                    
                    {/* Festival Management Routes */}
                    <Route path="/festival-management/:jobId" element={<FestivalManagement />} />
                    <Route path="/festival-management/:jobId/artists" element={<FestivalArtistManagement />} />
                    <Route path="/festival-management/:jobId/gear" element={<FestivalGearManagement />} />
                    <Route path="/festival-management/:jobId/scheduling" element={<FestivalManagement />} />
                    
                    {/* Job Management Routes */}
                    <Route path="/job-management/:jobId" element={<JobManagement />} />
                    <Route path="/job-management/:jobId/artists" element={<FestivalArtistManagement />} />
                    <Route path="/job-management/:jobId/gear" element={<FestivalGearManagement />} />
                    <Route path="/job-management/:jobId/scheduling" element={<JobManagement />} />
                  </Route>
                </Routes>
                <Toaster />
              </div>
            </AuthProvider>
          </Router>
        </SubscriptionProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
