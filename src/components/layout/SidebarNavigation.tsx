import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Music2,
  Lightbulb,
  Video,
  Settings,
  Briefcase,
  UserCircle,
  Truck
} from "lucide-react";

interface SidebarNavigationProps {
  userRole: string | null;
}

export const SidebarNavigation = ({ userRole }: SidebarNavigationProps) => {
  const location = useLocation();
  console.log('Current user role in navigation:', userRole);

  // Only admin, logistics, and management can access project management
  const isAuthorizedForProjectManagement = ['admin', 'logistics', 'management'].includes(userRole || '');
  
  // Only admin and management can access department pages
  const isAuthorizedForDepartments = ['admin', 'management'].includes(userRole || '');
  
  // Admin and management can access settings
  const isAuthorizedForSettings = ['admin', 'management'].includes(userRole || '');

  // Technicians should only see technician dashboard
  const isTechnician = userRole === 'technician';

  // Don't render navigation until role is loaded
  if (!userRole) {
    console.log('User role not yet loaded, waiting...');
    return null;
  }

  return (
    <div className="space-y-2">
      <div>
        <Link to={isTechnician ? "/technician-dashboard" : "/dashboard"}>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 ${
              location.pathname === (isTechnician ? "/technician-dashboard" : "/dashboard") ? "bg-accent" : ""
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Button>
        </Link>

        {isAuthorizedForProjectManagement && (
          <>
            <Link to="/project-management">
              <Button
                variant="ghost"
                className={`w-full justify-start gap-2 ${
                  location.pathname === "/project-management" ? "bg-accent" : ""
                }`}
              >
                <Briefcase className="h-4 w-4" />
                <span>Project Management</span>
              </Button>
            </Link>

            <Link to="/logistics">
              <Button
                variant="ghost"
                className={`w-full justify-start gap-2 ${
                  location.pathname === "/logistics" ? "bg-accent" : ""
                }`}
              >
                <Truck className="h-4 w-4" />
                <span>Logistics</span>
              </Button>
            </Link>
          </>
        )}

        {isAuthorizedForDepartments && (
          <>
            <Link to="/sound">
              <Button
                variant="ghost"
                className={`w-full justify-start gap-2 ${
                  location.pathname === "/sound" ? "bg-accent" : ""
                }`}
              >
                <Music2 className="h-4 w-4" />
                <span>Sound</span>
              </Button>
            </Link>

            <Link to="/lights">
              <Button
                variant="ghost"
                className={`w-full justify-start gap-2 ${
                  location.pathname === "/lights" ? "bg-accent" : ""
                }`}
              >
                <Lightbulb className="h-4 w-4" />
                <span>Lights</span>
              </Button>
            </Link>

            <Link to="/video">
              <Button
                variant="ghost"
                className={`w-full justify-start gap-2 ${
                  location.pathname === "/video" ? "bg-accent" : ""
                }`}
              >
                <Video className="h-4 w-4" />
                <span>Video</span>
              </Button>
            </Link>
          </>
        )}

        {isTechnician && (
          <Link to="/profile">
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 ${
                location.pathname === "/profile" ? "bg-accent" : ""
              }`}
            >
              <UserCircle className="h-4 w-4" />
              <span>Profile</span>
            </Button>
          </Link>
        )}

        {isAuthorizedForSettings && (
          <Link to="/settings">
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 ${
                location.pathname === "/settings" ? "bg-accent" : ""
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};