import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { Suspense, lazy, useEffect } from 'react';
import { AppInit } from './components/AppInit';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'sonner';
import { SubscriptionProvider } from '@/providers/SubscriptionProvider';
import { DateProvider } from '@/hooks/useDateContext';

// Lazy-loaded components for better initial load performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Jobs = lazy(() => import('./pages/Jobs'));
const ProjectManagement = lazy(() => import('./pages/ProjectManagement'));
const Disponibilidad = lazy(() => import('./pages/Disponibilidad'));
const Equipment = lazy(() => import('./pages/Equipment'));
const Lights = lazy(() => import('./pages/Lights'));
const Sound = lazy(() => import('./pages/Sound'));
const Video = lazy(() => import('./pages/Video'));
const Auth = lazy(() => import('./pages/Auth'));
const Profile = lazy(() => import('./pages/Profile'));
const LaborPOForm = lazy(() => import('./pages/LaborPOForm'));
const HojaDeRuta = lazy(() => import('./pages/HojaDeRuta'));
const FestivalScheduling = lazy(() => import('./pages/FestivalScheduling'));
const Logistics = lazy(() => import('./pages/Logistics'));

import './App.css';

function App() {
  const location = useLocation();
  
  // Track page views and performance
  useEffect(() => {
    // Log navigation for performance monitoring
    console.log(`Page navigation: ${location.pathname}${location.search}`);
    
    // Report performance metrics
    if (window.performance) {
      const perf = window.performance.timing;
      const pageLoadTime = perf.loadEventEnd - perf.navigationStart;
      console.log(`Page load time: ${pageLoadTime}ms`);
    }
    
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
      <SubscriptionProvider>
        <DateProvider>
          <AppInit>
            <Suspense fallback={<div>Loading...</div>}>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route path="/" element={<RequireAuth />}>
                    <Route index element={<Dashboard />} />
                    <Route path="/jobs" element={<Jobs />} />
                    <Route path="/project-management" element={<ProjectManagement />} />
                    <Route path="/disponibilidad" element={<Disponibilidad />} />
                    <Route path="/equipment" element={<Equipment />} />
                    <Route path="/lights" element={<Lights />} />
                    <Route path="/sound" element={<Sound />} />
                    <Route path="/video" element={<Video />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/labor-po-form" element={<LaborPOForm />} />
                    <Route path="/hoja-de-ruta" element={<HojaDeRuta />} />
					          <Route path="/festival-scheduling" element={<FestivalScheduling />} />
                    <Route path="/logistics" element={<Logistics />} />
                  </Route>
                  <Route path="/auth" element={<Auth />} />
                </Route>
              </Routes>
            </Suspense>
            <Toaster position="top-right" />
          </AppInit>
        </DateProvider>
      </SubscriptionProvider>
    </ErrorBoundary>
  );
}

export default App;
