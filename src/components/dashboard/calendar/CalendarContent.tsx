
import React from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarFilters } from "./CalendarFilters";
import { PrintSettingsDialog } from "./PrintSettingsDialog";
import { DateTypesContext } from "./DateTypesContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCalendarContext } from "./CalendarProvider";

interface CalendarContentProps {
  allDays: Date[];
  currentMonth: Date;
  jobs: any[];
  department?: string;
  onDateSelect: (date: Date) => void;
  onDateTypeChange: () => void;
}

export const CalendarContent: React.FC<CalendarContentProps> = ({
  allDays,
  currentMonth,
  jobs,
  department,
  onDateSelect,
  onDateTypeChange,
}) => {
  const {
    isCollapsed,
    isDropdownOpen,
    showPrintDialog,
    selectedJobTypes,
    distinctJobTypes,
    printSettings,
    setIsDropdownOpen,
    setShowPrintDialog,
    setPrintSettings,
    toggleCollapse,
    handleJobTypeSelection,
    handlePreviousMonth,
    handleNextMonth,
    handleTodayClick,
    generatePDF
  } = useCalendarContext();

  const dateTypesContext = React.useContext(DateTypesContext);
  
  return (
    <div className="space-y-4">
      <CalendarHeader
        currentMonth={currentMonth}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onTodayClick={handleTodayClick}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        showPrintDialog={showPrintDialog}
        setShowPrintDialog={setShowPrintDialog}
      />
      
      {!isCollapsed && (
        <div className="mb-4">
          <CalendarFilters 
            isDropdownOpen={isDropdownOpen}
            setIsDropdownOpen={setIsDropdownOpen}
            selectedJobTypes={selectedJobTypes}
            distinctJobTypes={distinctJobTypes}
            handleJobTypeSelection={handleJobTypeSelection}
          />
        </div>
      )}
      
      <CalendarGrid 
        days={allDays} 
        jobs={jobs} 
        currentMonth={currentMonth} 
        onDateSelect={onDateSelect}
        selectedJobTypes={selectedJobTypes}
        department={department}
        onDateTypeChange={onDateTypeChange}
      />
      
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent>
          <PrintSettingsDialog 
            onSave={(settings) => {
              setPrintSettings(settings);
              generatePDF(settings.range, dateTypesContext?.dateTypes || {});
              setShowPrintDialog(false);
            }}
            settings={printSettings}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
