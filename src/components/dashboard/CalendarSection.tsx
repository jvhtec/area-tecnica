
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DateTypesProvider } from "./calendar/DateTypesContext";
import { useCalendarState } from "./calendar/useCalendarState";
import { CalendarHeader } from "./calendar/CalendarHeader";
import { CalendarFilters } from "./calendar/CalendarFilters";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { PrintSettingsDialog } from "./calendar/PrintSettingsDialog";
import { getJobsForDate } from "./calendar/CalendarUtils";
import { useDateTypesContext } from "./calendar/DateTypesContext";

interface CalendarSectionProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department?: string;
  onDateTypeChange: () => void;
}

export const CalendarSection: React.FC<CalendarSectionProps> = ({
  date = new Date(),
  onDateSelect,
  jobs = [],
  department,
  onDateTypeChange,
}) => {
  const currentMonth = date || new Date();
  
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
    getCalendarDaysData
  } = useCalendarState(jobs, onDateSelect);

  const { allDays } = getCalendarDaysData(currentMonth);
  
  const CalendarContent = () => {
    const { dateTypes } = useDateTypesContext();
    
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

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-grow p-4">
        <DateTypesProvider jobs={jobs}>
          <CalendarContent />
        </DateTypesProvider>
      </CardContent>
    </Card>
  );
};
