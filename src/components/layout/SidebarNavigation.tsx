
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Music2,
  Lightbulb,
  Video,
  Settings,
  Truck,
  UserCircle
} from "lucide-react";

interface SidebarNavigationProps {
  userRole: string | null;
  userDepartment?: string | null;
}

export const SidebarNavigation = ({ userRole, userDepartment }: SidebarNavigationProps) => {
  const location = useLocation();
  console.log('Current user role in navigation:', userRole);
  console.log('Current user department in navigation:', userDepartment);

  // House techs and technicians should see technician dashboard
  const isTechnicianOrHouseTech = ['technician', 'house_tech'].includes(userRole || '');
  
  // House techs have access to logistics
  const isAuthorizedForLogistics = ['admin', 'logistics', 'management', 'house_tech'].includes(userRole || '');

  // Admin and management can access settings
  const isAuthorizedForSettings = ['admin', 'management'].includes(userRole || '');

  // Don't render navigation until role is loaded
  if (!userRole) {
    console.log('User role not yet loaded, waiting...');
    return null;
  }

  const getDepartmentIcon = (department: string) => {
    switch (department.toLowerCase()) {
      case 'sound':
        return <Music2 className="h-4 w-4" />;
      case 'lights':
        return <Lightbulb className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div>
        {/* Technician Dashboard */}
        {isTechnicianOrHouseTech && (
          <Link to="/technician-dashboard">
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 ${
                location.pathname === "/technician-dashboard" ? "bg-accent" : ""
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Technician Dashboard</span>
            </Button>
          </Link>
        )}

        {/* Department Page for House Techs */}
        {userRole === 'house_tech' && userDepartment && (
          <Link to={`/${userDepartment.toLowerCase()}`}>
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 ${
                location.pathname === `/${userDepartment.toLowerCase()}` ? "bg-accent" : ""
              }`}
            >
              {getDepartmentIcon(userDepartment)}
              <span>{userDepartment}</span>
            </Button>
          </Link>
        )}

        {/* Logistics Access */}
        {isAuthorizedForLogistics && (
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
        )}

        {/* Profile Access */}
        {(isTechnicianOrHouseTech || userRole === 'house_tech') && (
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

        {/* Settings Access */}
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
