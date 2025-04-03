
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Sound from "./pages/Sound";
import Lights from "./pages/Lights";
import Video from "./pages/Video";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import Logistics from "./pages/Logistics";
import ProjectManagement from "./pages/ProjectManagement";
import Festivals from "./pages/Festivals";
import FestivalManagement from "./pages/FestivalManagement";
import FestivalArtistManagement from "./pages/FestivalArtistManagement";
import FestivalGearManagement from "./pages/FestivalGearManagement";
import HojaDeRuta from "./pages/HojaDeRuta";
import LaborPOForm from "./pages/LaborPOForm";
import { useAuth } from "./hooks/useAuth";

export function AppRoutes() {
  const { session, userRole, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" replace />} />
      
      {/* Protected routes that require authentication */}
      {session ? (
        <>
          <Route element={<Layout />}>
            <Route path="/" element={userRole === 'technician' ? <Navigate to="/technician-dashboard" /> : <Dashboard />} />
            <Route path="/dashboard" element={userRole === 'technician' ? <Navigate to="/technician-dashboard" /> : <Dashboard />} />
            <Route path="/sound" element={<Sound />} />
            <Route path="/lights" element={<Lights />} />
            <Route path="/video" element={<Video />} />
            <Route path="/technician-dashboard" element={<TechnicianDashboard />} />
            <Route path="/logistics" element={<Logistics />} />
            <Route path="/project-management" element={<ProjectManagement />} />
            <Route path="/festivals" element={<Festivals />} />
            <Route path="/festival-management" element={<FestivalManagement />} />
            <Route path="/festival-artist-management" element={<FestivalArtistManagement />} />
            <Route path="/festival-gear-management" element={<FestivalGearManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/hoja-de-ruta" element={<HojaDeRuta />} />
            <Route path="/labor-po-form" element={<LaborPOForm />} />
          </Route>
        </>
      ) : (
        // Redirect to auth if not logged in
        <Route path="*" element={<Navigate to="/auth" replace />} />
      )}
    </Routes>
  );
}
