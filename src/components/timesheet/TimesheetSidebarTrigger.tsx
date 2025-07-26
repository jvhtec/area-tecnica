import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { TimesheetSidebar } from "./TimesheetSidebar";

interface TimesheetSidebarTriggerProps {
  userRole: string | null;
}

export const TimesheetSidebarTrigger = ({ userRole }: TimesheetSidebarTriggerProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Available to all authenticated users
  if (!userRole) return null;

  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start gap-2"
        onClick={() => setIsSidebarOpen(true)}
      >
        <Clock className="h-4 w-4" />
        <span>My Timesheets</span>
      </Button>
      
      <TimesheetSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
    </>
  );
};