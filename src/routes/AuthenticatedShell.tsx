import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { AppInit } from "@/components/AppInit";
import { useActivityPushFallback } from "@/hooks/useActivityPushFallback";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { AchievementBanner } from "@/components/achievements/AchievementBanner";

function ActivityPushFallbackInit() {
  useActivityPushFallback();
  return null;
}

// Redirect 'technician' role to /tech-app (house_tech can access Layout routes).
// Allow-list a small set of technician-accessible routes outside /tech-app (e.g. tools like SysCalc).
function TechnicianRouteGuard() {
  const { userRole, isLoading, isProfileLoading } = useOptimizedAuth();
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isLoading || isProfileLoading) return;
    if (userRole !== "technician") return;
    const isAllowedTechnicianRoute =
      location.pathname === "/tech-app" ||
      location.pathname === "/syscalc" ||
      location.pathname === "/achievements" ||
      location.pathname === "/auth" ||
      location.pathname.startsWith("/auth");

    if (isAllowedTechnicianRoute) {
      return;
    }

    navigate("/tech-app", { replace: true });
  }, [userRole, isLoading, isProfileLoading, location.pathname, navigate]);

  return null;
}

function OscarRouteGuard() {
  const { userRole, isLoading, isProfileLoading } = useOptimizedAuth();
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isLoading || isProfileLoading) return;
    if (userRole !== "oscar") return;

    const isAllowedOscarRoute =
      location.pathname === "/dashboard" ||
      location.pathname === "/tasks" ||
      location.pathname === "/profile" ||
      location.pathname === "/auth" ||
      location.pathname.startsWith("/auth");

    if (isAllowedOscarRoute) {
      return;
    }

    navigate("/dashboard", { replace: true });
  }, [userRole, isLoading, isProfileLoading, location.pathname, navigate]);

  return null;
}

export default function AuthenticatedShell() {
  return (
    <RequireAuth>
      <SubscriptionProvider>
        <AppInit />
        <ActivityPushFallbackInit />
        <TechnicianRouteGuard />
        <OscarRouteGuard />
        <AchievementBanner />
        <Outlet />
      </SubscriptionProvider>
    </RequireAuth>
  );
}
