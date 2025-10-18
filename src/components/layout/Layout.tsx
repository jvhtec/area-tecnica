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
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserInfo } from "@/components/layout/UserInfo";
import { SidebarNavigation } from "@/components/layout/SidebarNavigation";
import { AboutCard } from "@/components/layout/AboutCard";
import { NotificationBadge } from "@/components/layout/NotificationBadge";
import { useQueryClient } from "@tanstack/react-query";
import { ReloadButton } from "@/components/ui/reload-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { HeaderStatus } from "@/components/ui/header-status";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useActivityRealtime } from "@/features/activity/hooks/useActivityRealtime";
import { HelpButton } from "@/components/layout/HelpButton";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const {
    session,
    userRole,
    userDepartment,
    isLoading,
    logout
  } = useOptimizedAuth();

  useActivityRealtime({
    userId: session?.user?.id,
  });

  // Redirect technicians and house techs to technician dashboard if they somehow get to the regular dashboard
  useEffect(() => {
    if (!isLoading && (userRole === 'technician' || userRole === 'house_tech') && location.pathname === '/dashboard') {
      console.log('Technician or house tech on dashboard, redirecting to technician dashboard');
      navigate('/technician-dashboard');
    }
  }, [userRole, location.pathname, isLoading, navigate]);

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
    navigate('/auth', { replace: true });
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarNavigation userRole={userRole} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            <ThemeToggle />
            <UserInfo />
            {session?.user?.id && (
              <NotificationBadge 
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
              <span>{isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</span>
            </Button>
            <AboutCard userRole={userRole} userEmail={session?.user?.email || undefined} />
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
        <div className="flex-1">
          <header className="border-b p-4 pt-[max(1rem,env(safe-area-inset-top))] flex justify-between items-center bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-2">
              <HeaderStatus className="mr-3" />
              <HelpButton />
              <ReloadButton onReload={handleReload} />
            </div>
          </header>
          <main className="p-6">
            <Outlet />
          </main>
        </div>
        </div>
      </SidebarProvider>
  );
};

export default Layout;
