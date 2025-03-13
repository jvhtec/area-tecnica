
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider"
import Layout from "./components/Layout";
import { supabase } from "./lib/supabase";
import { Toaster } from "@/components/ui/toaster"
import FestivalSchedulingPage from "./pages/FestivalSchedulingPage";

// Import the format function from date-fns
import { format } from "date-fns";

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
            {/* Temporary placeholder route until we fix the missing imports */}
            <Route path="/" element={<div>Home Page</div>} />
            <Route path="/jobs" element={<div>Jobs Page</div>} />
            <Route path="/technicians" element={<div>Technicians Page</div>} />
            <Route path="/departments" element={<div>Departments Page</div>} />
            <Route path="/locations" element={<div>Locations Page</div>} />
            <Route path="/auth" element={<div>Auth Page</div>} />
            <Route path="/account" element={<div>Account Page</div>} />
            <Route path="/tours" element={<div>Tours Page</div>} />
            
            {/* Festival management routes */}
            <Route path="/festival-management/:jobId/scheduling" element={<FestivalSchedulingPage />} />
            <Route path="/festival-management/:jobId" element={<div>Festival Management</div>} />
            <Route path="/festival-management/:jobId/artists" element={<div>Artist Management</div>} />
            <Route path="/festival-management/:jobId/gear" element={<div>Gear Management</div>} />
          </Routes>
          <Toaster />
        </Layout>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
