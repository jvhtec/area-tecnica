import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Mapping of routes to their manual section anchors
const routeToSection: Record<string, string> = {
  "/dashboard": "#dashboard",
  "/technician-dashboard": "#techniciandashboard",
  "/personal": "#personal",
  "/sound": "#sound",
  "/lights": "#lights",
  "/video": "#video",
  "/logistics": "#logistics",
  "/profile": "#profile",
  "/settings": "#settings",
  "/project-management": "#projectmanagement",
  "/equipment-management": "#equipmentmanagement",
  "/job-assignment-matrix": "#jobassignmentmatrix",
  "/timesheets": "#timesheets",
  "/tours": "#tours",
  "/festivals": "#festivals",
  "/pesos-tool": "#pesostool",
  "/lights-pesos-tool": "#lightspesostool",
  "/video-pesos-tool": "#videopesostool",
  "/consumos-tool": "#consumostool",
  "/lights-consumos-tool": "#lightsconsumostool",
  "/video-consumos-tool": "#videoconsumostool",
  "/lights-memoria-tecnica": "#lightsmemoratecnica",
  "/video-memoria-tecnica": "#videomemoratecnica",
  "/hoja-de-ruta": "#hojaderuta",
  "/disponibilidad": "#lightsdisponibilidad",
  "/festival-management": "#festivalmanagement",
  "/auth": "#auth",
};

// Get friendly page name for tooltip
const getPageName = (pathname: string): string => {
  // Handle festival and tour management dynamic routes
  if (pathname.includes("/festival-management/")) {
    if (pathname.includes("/artists")) return "Festival Artist Management";
    if (pathname.includes("/gear")) return "Festival Gear Management";
    return "Festival Management";
  }
  
  if (pathname.includes("/tour-management/")) {
    return "Tour Management";
  }

  // Handle tour-specific tool routes
  if (pathname.includes("/tours/") && (pathname.includes("/pesos") || pathname.includes("/consumos"))) {
    const segments = pathname.split("/");
    const toolType = segments[segments.length - 1]; // "pesos" or "consumos"
    const category = segments[segments.length - 2]; // "sound", "lights", "video"
    return `${category.charAt(0).toUpperCase() + category.slice(1)} ${toolType.charAt(0).toUpperCase() + toolType.slice(1)} Tool`;
  }

  // Standard route mapping
  const routeMap: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/technician-dashboard": "Technician Dashboard",
    "/personal": "Personal Management",
    "/sound": "Sound Management",
    "/lights": "Lights Management",
    "/video": "Video Management",
    "/logistics": "Logistics",
    "/profile": "Profile",
    "/settings": "Settings",
    "/project-management": "Project Management",
    "/equipment-management": "Equipment Management",
    "/job-assignment-matrix": "Job Assignment Matrix",
    "/timesheets": "Timesheets",
    "/tours": "Tours",
    "/festivals": "Festivals",
    "/pesos-tool": "Weights Tool",
    "/lights-pesos-tool": "Lights Weights Tool",
    "/video-pesos-tool": "Video Weights Tool",
    "/consumos-tool": "Consumption Tool",
    "/lights-consumos-tool": "Lights Consumption Tool",
    "/video-consumos-tool": "Video Consumption Tool",
    "/lights-memoria-tecnica": "Lights Technical Memory",
    "/video-memoria-tecnica": "Video Technical Memory",
    "/hoja-de-ruta": "Hoja de Ruta",
    "/lights-disponibilidad": "Lights Availability",
    "/manual": "User Manual",
    "/auth": "Authentication",
  };

  return routeMap[pathname] || "Help";
};

export const HelpButton = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleHelpClick = () => {
    const pathname = location.pathname;
    
    // Check if we're already on the manual page
    if (pathname === "/manual") {
      return;
    }

    // Find the appropriate section or default to manual home
    let targetSection = "#introduction";
    
    // Direct route match
    if (routeToSection[pathname]) {
      targetSection = routeToSection[pathname];
    } else {
      // Check for dynamic routes
      if (pathname.includes("/festival-management/")) {
        if (pathname.includes("/artists")) {
          targetSection = "#festivalartistmanagement";
        } else if (pathname.includes("/gear")) {
          targetSection = "#festivalgearmanagement";
        } else {
          targetSection = "#festivalmanagement";
        }
      } else if (pathname.includes("/tour-management/")) {
        targetSection = "#tourmanagement";
      } else if (pathname.includes("/tours/") && (pathname.includes("/pesos") || pathname.includes("/consumos"))) {
        // For tour-specific tools, redirect to the general tool section
        if (pathname.includes("/pesos")) {
          if (pathname.includes("/lights/")) targetSection = "#lightspesostool";
          else if (pathname.includes("/video/")) targetSection = "#videopesostool";
          else targetSection = "#pesostool";
        } else if (pathname.includes("/consumos")) {
          if (pathname.includes("/lights/")) targetSection = "#lightsconsumostool";
          else if (pathname.includes("/video/")) targetSection = "#videoconsumostool";
          else targetSection = "#consumostool";
        }
      }
    }

    // Navigate to manual with section
    navigate(`/manual${targetSection}`);
  };

  const pageName = getPageName(location.pathname);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleHelpClick}
            className="h-9 w-9"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Help: {pageName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
