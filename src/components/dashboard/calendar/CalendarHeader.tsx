
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

interface CalendarHeaderProps {
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onTodayClick: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  showPrintDialog: boolean;
  setShowPrintDialog: (open: boolean) => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onTodayClick,
  isCollapsed,
  onToggleCollapse,
  showPrintDialog,
  setShowPrintDialog,
}) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" onClick={onPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onTodayClick}>
          Today
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Printer className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>
    </div>
  );
};
