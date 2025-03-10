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
import { useNavigate, Outlet, Navigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "./layout/ThemeToggle";
import { UserInfo } from "./layout/UserInfo";
import { SidebarNavigation } from "./layout/SidebarNavigation";
import { AboutCard } from "./layout/AboutCard";
import { NotificationBadge } from "./layout/NotificationBadge";
import { useToast } from "@/hooks/use-toast";
import { useSessionManager } from "@/hooks/useSessionManager";
import { ReloadButton } from "./ui/reload-button";
import { useQueryClient } from "@tanstack/react-query";
import { useKonamiCode } from "@/hooks/useKonamiCode";
import { WolfensteinDialog } from "./doom/WolfensteinDialog";
import { useIsMobile } from "@/hooks/use-mobile";

const Layout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient();
  const { triggered: doomTriggered, reset: resetDoom, handleLogoTap, tapCount } = useKonamiCode();
  const isMobile = useIsMobile();
  
  const {
    session,
    userRole,
    userDepartment,
    isLoading,
    setSession,
    setUserRole,
    setUserDepartment
  } = useSessionManager();

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    console.log("Starting sign out process");

    try {
      // Clear all state first
      setSession(null);
      setUserRole(null);
      setUserDepartment(null);
      localStorage.clear();
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      console.log("Sign out successful");
      
      // Navigate to auth page after everything is cleared
      navigate('/auth', { replace: true });
      
      toast({
        title: "Success",
        description: "You have been logged out successfully",
      });
    } catch (error) {
      console.error("Error during sign out:", error);
      toast({
        title: "Notice",
        description: "You have been logged out",
      });
      // Still navigate to auth page even if there's an error
      navigate('/auth', { replace: true });
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
              <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </Button>
            <AboutCard />
            <SidebarSeparator />
            <div 
              className="px-2 py-4 cursor-pointer transition-opacity"
              onClick={handleLogoTap}
              style={{ opacity: tapCount > 0 ? 0.5 + (tapCount * 0.1) : 1 }}
            >
              <img
                src="/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png"
                alt="Sector Pro Logo"
                className="h-6 w-auto dark:invert"
                draggable="false"
              />
              {isMobile && tapCount > 0 && (
                <div className="text-xs text-center mt-1 text-muted-foreground">
                  {5 - tapCount} more taps...
                </div>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1">
          <header className="border-b p-4 flex justify-between items-center bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-2">
              <ReloadButton onReload={handleReload} />
            </div>
          </header>
          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <WolfensteinDialog 
        open={doomTriggered} 
        onOpenChange={(open) => !open && resetDoom()} 
      />
    </SidebarProvider>
  );
};

export default Layout;
