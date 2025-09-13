import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Music2,
  Lightbulb,
  Video,
  Settings,
  Truck,
  UserCircle,
  ClipboardList,
  Tent,
  Calendar,
  MapPin,
  Grid3X3,
  Clock,
  FileText
} from "lucide-react";
import { TimesheetSidebarTrigger } from "@/components/timesheet/TimesheetSidebarTrigger";
import { SidebarNavigationSkeleton } from './SidebarNavigationSkeleton';

interface SidebarNavigationProps {
  userRole: string | null;
  userDepartment?: string | null;
}

export const SidebarNavigation = ({ userRole, userDepartment }: SidebarNavigationProps) => {
  const location = useLocation();
  console.log('Current user role in navigation:', userRole);
  console.log('Current user department in navigation:', userDepartment);

  // Only show technician dashboard to technicians and house techs
  const isTechnicianOrHouseTech = ['technician', 'house_tech'].includes(userRole || '');
  
  // Management users have access to everything
  const isManagementUser = userRole === 'management';
  
  // Check if user is in sound department
  const isSoundDepartment = userDepartment?.toLowerCase() === 'sound';

  // Check if user is house tech from sound department
  const isSoundHouseTech = userRole === 'house_tech' && isSoundDepartment;

  // Show skeleton instead of nothing while role loads
  if (!userRole) {
    console.log('User role not yet loaded, showing skeleton...');
    return <SidebarNavigationSkeleton />;
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
        {/* Main Dashboard for Management Users */}
        {isManagementUser && (
          <Link to="/dashboard">
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 ${
                location.pathname === "/dashboard" ? "bg-accent" : ""
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>
          </Link>
        )}

        {/* Technician Dashboard for Technicians/House Techs */}
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

        {/* Personal Calendar - Available to all authenticated users */}
        <Link to="/personal">
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 ${
              location.pathname === "/personal" ? "bg-accent" : ""
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Personal Calendar</span>
          </Button>
        </Link>

        {/* Job Assignment Matrix - Only for management users */}
        {isManagementUser && (
          <Link to="/job-assignment-matrix">
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 ${
                location.pathname === "/job-assignment-matrix" ? "bg-accent" : ""
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
              <span>Assignment Matrix</span>
            </Button>
          </Link>
        )}

        {/* Timesheets - Available for all users */}
        <TimesheetSidebarTrigger userRole={userRole} />

        {/* Department Pages - Show for Management and House Techs */}
        {(isManagementUser || userRole === 'house_tech') && (
          <>
            {/* Sound Department */}
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

            {/* Lights Department */}
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

            {/* Video Department */}
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

            {/* Tours - Only show for management users and house techs from sound department */}
            {(isManagementUser || isSoundHouseTech) && (
              <Link to="/tours">
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-2 ${
                    location.pathname === "/tours" ? "bg-accent" : ""
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  <span>Tours</span>
                </Button>
              </Link>
            )}
            
            {/* Festivals - Only show for management users and house techs from sound department */}
            {(isManagementUser || isSoundHouseTech) && (
              <Link to="/festivals">
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-2 ${
                    location.pathname === "/festivals" ? "bg-accent" : ""
                  }`}
                >
                  <Tent className="h-4 w-4" />
                  <span>Festivals</span>
                </Button>
              </Link>
            )}
          </>
        )}

        {/* Department Page for House Techs - specific to their department */}
        {userRole === 'house_tech' && userDepartment && !isManagementUser && (
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

        {/* Project Management - Available to management, admin, and logistics */}
        {(['admin', 'logistics', 'management'].includes(userRole)) && (
          <Link to="/project-management">
            <Button
              variant="ghost"
              className={`w-full justify-start gap-2 ${
                location.pathname === "/project-management" ? "bg-accent" : ""
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              <span>Project Management</span>
            </Button>
          </Link>
        )}

        {/* Logistics Access - Available to management, admin, logistics, and house techs */}
        {(['admin', 'logistics', 'management', 'house_tech'].includes(userRole)) && (
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

        {/* Profile Access - Available to everyone */}
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

        {/* Settings Access - Available to admin and management */}
        {(['admin', 'management'].includes(userRole)) && (
          <>
            <Link to="/incident-reports">
              <Button
                variant="ghost"
                className={`w-full justify-start gap-2 ${
                  location.pathname === "/incident-reports" ? "bg-accent" : ""
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Incident Reports</span>
              </Button>
            </Link>
            
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
          </>
        )}
      </div>
    </div>
  );
};
