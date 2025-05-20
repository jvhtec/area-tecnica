
import React, { createContext, useContext, useState, useCallback } from "react";
import { PrintSettings } from "./PrintSettingsDialog";
import { useCalendarState } from "./useCalendarState";

interface CalendarContextType {
  currentMonth: Date;
  isCollapsed: boolean;
  isDropdownOpen: boolean;
  showPrintDialog: boolean;
  selectedJobTypes: string[];
  distinctJobTypes: string[];
  printSettings: PrintSettings;
  setIsDropdownOpen: (open: boolean) => void;
  setShowPrintDialog: (open: boolean) => void;
  setPrintSettings: React.Dispatch<React.SetStateAction<PrintSettings>>;
  toggleCollapse: () => void;
  handleJobTypeSelection: (type: string) => void;
  handlePreviousMonth: () => void;
  handleNextMonth: () => void;
  handleTodayClick: () => void;
  generatePDF: (range: "month" | "quarter" | "year", dateTypes: Record<string, any>) => void;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const useCalendarContext = () => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendarContext must be used within a CalendarProvider");
  }
  return context;
};

interface CalendarProviderProps {
  jobs: any[];
  onDateSelect: (date: Date) => void;
  date: Date;
  children: React.ReactNode;
}

export const CalendarProvider: React.FC<CalendarProviderProps> = ({
  jobs,
  onDateSelect,
  date,
  children,
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
  } = useCalendarState(jobs, onDateSelect);

  const value = {
    currentMonth,
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
  };

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
};
