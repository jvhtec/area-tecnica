
import { Button } from "@/components/ui/button";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarFooter,
  SidebarSeparator,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";
import { useNavigate, Outlet, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { ThemeToggle } from "./layout/ThemeToggle";
import { UserInfo } from "./layout/UserInfo";
import { SidebarNavigation } from "./layout/SidebarNavigation";
import { AboutCard } from "./layout/AboutCard";
import { LazyNotificationBadge } from "./layout/LazyNotificationBadge";
import { ReloadButton } from "./ui/reload-button";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { HeaderStatus } from "./ui/header-status";
import { useRouteSubscriptions } from "@/hooks/useRouteSubscriptions";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { getDashboardPath } from "@/utils/roleBasedRouting";
import { UserRole } from "@/types/user";

const Layout = () => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const location = useLocation();
  
  const {
    session,
    userRole,
    userDepartment,
    hasSoundVisionAccess,
    isLoading,
    logout
  } = useOptimizedAuth();
  
  // Get route-specific subscription info
  const { requiredTables } = useRouteSubscriptions();
  const { forceSubscribe } = useSubscriptionContext();
  
  // Subscribe to route-specific tables whenever the route changes
  useEffect(() => {
    if (requiredTables.length > 0) {
      const subscriptionObjects = requiredTables.map(table => ({
        table: table,
        queryKey: table
      }));
      forceSubscribe(subscriptionObjects);
    }
  }, [location.pathname, requiredTables, forceSubscribe]);

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    console.log("Starting sign out process");

    try {
      await logout();
    } catch (error) {
      console.error("Error during sign out:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleReload = async () => {
    console.log("Reloading all queries");
    await queryClient.refetchQueries();
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  if (!session) {
    console.log("No session found in Layout, redirecting to auth");
    return <Navigate to="/auth" replace />;
  }

  // Redirect to role-specific dashboard if on root or generic /dashboard
  if (location.pathname === '/' || location.pathname === '/dashboard') {
    const dashboardPath = getDashboardPath(userRole as UserRole | null);
    if (dashboardPath !== location.pathname) {
      return <Navigate to={dashboardPath} replace />;
    }
  }

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarNavigation
                  userRole={userRole}
                  userDepartment={userDepartment}
                  hasSoundVisionAccess={hasSoundVisionAccess}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            <ThemeToggle />
            <UserInfo />
            {session?.user?.id && (
              <LazyNotificationBadge 
                userId={session.user.id}
                userRole={userRole}
                userDepartment={userDepartment}
              />
            )}
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2" 
              onClick={handleSignOut}
              disabled={isLoggingOut}
            >
              <LogOut className="h-4 w-4" />
              <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </Button>
            <AboutCard />
            <SidebarSeparator />
            <div className="px-2 py-4">
              <img
                src="/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png"
                alt="Sector Pro Logo"
                className="h-6 w-auto dark:invert"
                draggable="false"
              />
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 min-w-0">
          <header className="border-b p-2 md:p-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-[max(1rem,env(safe-area-inset-top))] flex justify-between items-center bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <HeaderStatus className="mr-1 md:mr-3" />
              <ReloadButton onReload={handleReload} />
            </div>
          </header>
          <main className="p-2 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
