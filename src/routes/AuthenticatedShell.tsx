import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { AppInit } from "@/components/AppInit";
import { useActivityPushFallback } from "@/hooks/useActivityPushFallback";
import { useAuth } from "@/hooks/useAuth";

/**
 * Initializes the application's activity-push fallback mechanism and renders nothing.
 *
 * This component sets up fallback behavior for activity pushes (via an internal hook) and intentionally returns `null` so it does not render any UI.
 */
function ActivityPushFallbackInit() {
  useActivityPushFallback();
  return null;
}

// Redirect 'technician' role to /tech-app (house_tech can access Layout routes).
/**
 * Ensures technician users are confined to allowed routes and redirects them to /tech-app when they visit disallowed paths.
 *
 * Performs no rendering; when the current authenticated user's role is "technician" and the current pathname is not
 * one of the allowed technician routes ("/tech-app", "/syscalc", or any "/auth" path), navigates to "/tech-app" with replace.
 *
 * @returns Null — this component renders no UI.
 */
function TechnicianRouteGuard() {
  const { userRole, isLoading } = useAuth();
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