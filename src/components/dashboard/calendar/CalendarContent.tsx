
import React from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarFilters } from "./CalendarFilters";
import { PrintSettingsDialog } from "./PrintSettingsDialog";
import { useDateTypesContext } from "./DateTypesContext";
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
  const { dateTypes } = useDateTypesContext();
  
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
            distinctJobTypes={distinctJobTypes}
            selectedJobTypes={selectedJobTypes}
            isDropdownOpen={isDropdownOpen}
            setIsDropdownOpen={setIsDropdownOpen}
            onJobTypeSelection={handleJobTypeSelection}
          />
        </div>
      )}
      
      <CalendarGrid 
        allDays={allDays} 
        jobs={jobs} 
        currentMonth={currentMonth} 
        onDateSelect={onDateSelect}
        selectedJobTypes={selectedJobTypes}
        department={department}
        onDateTypeChange={onDateTypeChange}
        getJobsForDate={(date) => {
          // This is a temporary placeholder for the method
          return jobs.filter(job => {
            // Basic filter logic to be replaced by actual implementation
            return true;
          });
        }}
      />
      
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent>
          <PrintSettingsDialog 
            showDialog={showPrintDialog}
            setShowDialog={setShowPrintDialog}
            printSettings={printSettings}
            setPrintSettings={setPrintSettings}
            generatePDF={(range) => generatePDF(range, dateTypes)}
            currentMonth={currentMonth}
            selectedJobTypes={selectedJobTypes}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
