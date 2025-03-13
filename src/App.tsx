import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider"
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Jobs from "@/pages/Jobs";
import Technicians from "@/pages/Technicians";
import Departments from "@/pages/Departments";
import Locations from "@/pages/Locations";
import Auth from "@/pages/Auth";
import { supabase } from "./lib/supabase";
import Account from "@/pages/Account";
import { Toaster } from "@/components/ui/toaster"
import Tour from "@/pages/Tour";
import FestivalManagement from "@/pages/FestivalManagement";
import ArtistManagement from "@/pages/ArtistManagement";
import GearManagement from "@/pages/GearManagement";
import FestivalSchedulingPage from "@/pages/FestivalSchedulingPage";

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <Layout session={session}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/account" element={<Account session={session} />} />
            <Route path="/tours" element={<Tour />} />
            
            {/* Update the festival scheduling route to use the new standalone page */}
            <Route path="/festival-management/:jobId/scheduling" element={<FestivalSchedulingPage />} />
            <Route path="/festival-management/:jobId" element={<FestivalManagement />} />
            <Route path="/festival-management/:jobId/artists" element={<ArtistManagement />} />
            <Route path="/festival-management/:jobId/gear" element={<GearManagement />} />
          </Routes>
          <Toaster />
        </Layout>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
