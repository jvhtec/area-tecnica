import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { AppInit } from "@/components/AppInit";
import { useActivityPushFallback } from "@/hooks/useActivityPushFallback";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";

function ActivityPushFallbackInit() {
  useActivityPushFallback();
  return null;
}

// Redirect 'technician' role to /tech-app (house_tech can access Layout routes).
// Allow-list a small set of technician-accessible routes outside /tech-app (e.g. tools like SysCalc).
function TechnicianRouteGuard() {
  const { userRole, isLoading } = useOptimizedAuth();
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isLoading) return;
    if (userRole !== "technician") return;
    const isAllowedTechnicianRoute =
      location.pathname === "/tech-app" ||
      location.pathname === "/syscalc" ||
      location.pathname === "/auth" ||
      location.pathname.startsWith("/auth");

    if (isAllowedTechnicianRoute) {
      return;
    }

    navigate("/tech-app", { replace: true });
  }, [userRole, isLoading, location.pathname, navigate]);

  return null;
}

export default function AuthenticatedShell() {
  return (
    <RequireAuth>
      <SubscriptionProvider>
        <AppInit />
        <ActivityPushFallbackInit />
        <TechnicianRouteGuard />
        <Outlet />
      </SubscriptionProvider>
    </RequireAuth>
  );
}
