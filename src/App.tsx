import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from '@/lib/react-query';
import Layout from '@/components/Layout';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import Sound from '@/pages/Sound';
import Lights from '@/pages/Lights';
import Video from '@/pages/Video';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import ProjectManagement from '@/pages/ProjectManagement';
import TechnicianDashboard from '@/pages/TechnicianDashboard';
import PesosTool from '@/pages/PesosTool';
import LightsPesosTool from '@/pages/LightsPesosTool';
import VideoPesosTool from '@/pages/VideoPesosTool';
import ConsumosTool from '@/pages/ConsumosTool';
import LightsConsumosTool from '@/pages/LightsConsumosTool';
import VideoConsumosTool from '@/pages/VideoConsumosTool';
import ExcelTool from '@/pages/ExcelTool';
import HojaDeRuta from '@/pages/HojaDeRuta';
import LaborPOForm from '@/pages/LaborPOForm';
import Logistics from '@/pages/Logistics';
import FestivalManagement from '@/pages/FestivalManagement';
import FestivalArtistManagement from '@/pages/FestivalArtistManagement';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/*" element={<Layout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="sound" element={<Sound />} />
              <Route path="lights" element={<Lights />} />
              <Route path="video" element={<Video />} />
              <Route path="logistics" element={<Logistics />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="project-management" element={<ProjectManagement />} />
              <Route path="technician" element={<TechnicianDashboard />} />
              
              {/* Tools Routes */}
              <Route path="pesos-tool" element={<PesosTool />} />
              <Route path="lights-pesos-tool" element={<LightsPesosTool />} />
              <Route path="video-pesos-tool" element={<VideoPesosTool />} />
              <Route path="consumos-tool" element={<ConsumosTool />} />
              <Route path="lights-consumos-tool" element={<LightsConsumosTool />} />
              <Route path="video-consumos-tool" element={<VideoConsumosTool />} />
              <Route path="excel-tool" element={<ExcelTool />} />
              <Route path="hoja-de-ruta" element={<HojaDeRuta />} />
              <Route path="labor-po-form" element={<LaborPOForm />} />
              
              {/* Festival Management Routes */}
              <Route path="festival-management/:jobId" element={<FestivalManagement />} />
              <Route path="festival-management/:jobId/artists" element={<FestivalArtistManagement />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;