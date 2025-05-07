
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/react-query';
import { Toaster } from 'sonner';
import { SubscriptionProvider } from '@/providers/SubscriptionProvider';
import { AppInit } from '@/components/AppInit';
import { useUnifiedSession } from '@/hooks/useUnifiedSession';

// Import your pages here

function AuthenticatedApp() {
  const { session, userRole, userDepartment, isLoading } = useUnifiedSession();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!session) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <Routes>
      {/* Define your authenticated routes here */}
      <Route path="/dashboard" element={<div>Dashboard - User: {userRole}, Dept: {userDepartment}</div>} />
      
      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function UnauthenticatedApp() {
  return (
    <Routes>
      <Route path="/auth" element={<div>Login Page</div>} />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { session, isLoading } = useUnifiedSession();
  
  if (isLoading) {
    return <div>Loading session...</div>;
  }
  
  return session ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <Router>
          <AppInit />
          <AppContent />
          <Toaster position="top-right" richColors />
        </Router>
      </SubscriptionProvider>
    </QueryClientProvider>
  );
}

export default App;
