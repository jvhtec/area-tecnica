
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { PrintSettings } from "./PrintSettingsDialog";
import { generateCalendarPDF } from "./PDFGenerator";
import { getCalendarDays } from "./CalendarUtils";

export const useCalendarState = (jobs: any[] = [], onDateSelect: (date: Date) => void) => {
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [distinctJobTypes, setDistinctJobTypes] = useState<string[]>([]);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    range: "month",
    jobTypes: {
      tourdate: true,
      tour: true,
      single: true,
      dryhire: true,
      festival: true,
    },
  });
  
  // Extract all unique job types from the jobs array
  useEffect(() => {
    if (jobs) {
      const types = Array.from(new Set(jobs.map((job) => job.job_type).filter(Boolean)));
      setDistinctJobTypes(types);
    }
  }, [jobs]);

  // Load user preferences for job type filters
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("selected_job_types")
          .eq("id", session.user.id)
          .single();
          
        if (error) {
          console.error("Error loading user preferences:", error);
          return;
        }
        
        if (profile?.selected_job_types) {
          setSelectedJobTypes(profile.selected_job_types);
        }
      } catch (error) {
        console.error("Error in loadUserPreferences:", error);
      }
    };
    
    loadUserPreferences();
  }, []);

  // Save user preferences when selected job types change
  const saveUserPreferences = async (types: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      
      const { error } = await supabase
        .from("profiles")
        .update({ selected_job_types: types })
        .eq("id", session.user.id);
        
      if (error) {
        console.error("Error saving user preferences:", error);
        toast({
          title: "Error saving preferences",
          description: "Your filter preferences couldn't be saved.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in saveUserPreferences:", error);
    }
  };

  // Handle job type selection
  const handleJobTypeSelection = (type: string) => {
    const newTypes = selectedJobTypes.includes(type)
      ? selectedJobTypes.filter((t) => t !== type)
      : [...selectedJobTypes, type];
      
    setSelectedJobTypes(newTypes);
    saveUserPreferences(newTypes);
    setIsDropdownOpen(false);
  };

  // Navigation helpers
  const handlePreviousMonth = () => {
    const newDate = new Date();
    newDate.setMonth(newDate.getMonth() - 1);
    onDateSelect(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date();
    newDate.setMonth(newDate.getMonth() + 1);
    onDateSelect(newDate);
  };

  const handleTodayClick = () => {
    onDateSelect(new Date());
  };
  
  // Toggle collapse state
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // PDF generation
  const generatePDF = async (range: "month" | "quarter" | "year", dateTypes: Record<string, any>) => {
    try {
      await generateCalendarPDF(jobs, new Date(), range, printSettings, dateTypes);
      setShowPrintDialog(false);
      toast({
        title: "Success",
        description: `Calendar PDF for ${range} generated successfully.`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    // State
    isCollapsed,
    isDropdownOpen,
    showPrintDialog,
    selectedJobTypes,
    distinctJobTypes,
    printSettings,
    
    // Setters
    setIsCollapsed,
    setIsDropdownOpen,
    setShowPrintDialog,
    setPrintSettings,
    
    // Actions
    toggleCollapse,
    handleJobTypeSelection,
    handlePreviousMonth,
    handleNextMonth,
    handleTodayClick,
    generatePDF,
    
    // Calendar data
    getCalendarDaysData: useCallback((currentMonth: Date) => getCalendarDays(currentMonth), [])
  };
};
