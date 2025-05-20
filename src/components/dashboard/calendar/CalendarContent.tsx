
import React from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarFilters } from "./CalendarFilters";
import { CalendarGrid } from "./CalendarGrid";
import { PrintSettingsDialog } from "./PrintSettingsDialog";
import { getJobsForDate } from "./CalendarUtils";
import { useDateTypesContext } from "./DateTypesContext";
import { useCalendarContext } from "./CalendarProvider";

interface CalendarContentProps {
  allDays: Date[];
  currentMonth: Date;
  jobs: any[];
  department?: string;
  onDateSelect: (date: Date | undefined) => void;
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
    generatePDF,
  } = useCalendarContext();
  
  const handleGeneratePDF = (range: "month" | "quarter" | "year") => {
    generatePDF(range, dateTypes);
  };
  
  return (
    <>
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
      
      <PrintSettingsDialog
        showDialog={showPrintDialog}
        setShowDialog={setShowPrintDialog}
        printSettings={printSettings}
        setPrintSettings={setPrintSettings}
        generatePDF={handleGeneratePDF}
        currentMonth={currentMonth}
        selectedJobTypes={selectedJobTypes}
      />
      
      <CalendarFilters
        distinctJobTypes={distinctJobTypes}
        selectedJobTypes={selectedJobTypes}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        onJobTypeSelection={handleJobTypeSelection}
      />
      
      {!isCollapsed && (
        <CalendarGrid
          allDays={allDays}
          currentMonth={currentMonth}
          getJobsForDate={(date) => getJobsForDate(jobs, date, department, selectedJobTypes)}
          onDateSelect={onDateSelect}
        />
      )}
    </>
  );
};
