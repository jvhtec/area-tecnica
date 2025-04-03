
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useEnhancedQuery } from "@/hooks/useEnhancedQuery";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { toast } from "sonner";

interface UseEnhancedFestivalShiftsParams {
  jobId: string;
  selectedDate: string;
}

export function useEnhancedFestivalShifts({ jobId, selectedDate }: UseEnhancedFestivalShiftsParams) {
  const fetchShifts = useCallback(async () => {
    if (!selectedDate || !jobId) {
      return [];
    }
    
    try {
      console.log(`Executing fetch for job: ${jobId}, date: ${selectedDate}`);
      
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("festival_shifts")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("start_time");

      if (shiftsError) {
        console.error("Error fetching shifts:", shiftsError);
        throw shiftsError;
      }
      
      console.log("Shifts data retrieved:", shiftsData);

      if (!shiftsData || shiftsData.length === 0) {
        return [];
      }

      const shiftIds = shiftsData.map(shift => shift.id);
      
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("festival_shift_assignments")
        .select(`
          id,
          shift_id,
          technician_id,
          role
        `)
        .in("shift_id", shiftIds);

      if (assignmentsError) {
        console.error("Error fetching shift assignments:", assignmentsError);
        // Continue with empty assignments
      }

      let technicianProfiles: Record<string, any> = {};
      
      if (assignmentsData && assignmentsData.length > 0) {
        const technicianIds = [...new Set(assignmentsData.map(a => a.technician_id))];
        
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, department, role")
          .in("id", technicianIds);
          
        if (profilesError) {
          console.error("Error fetching technician profiles:", profilesError);
        } else if (profilesData) {
          technicianProfiles = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as Record<string, any>);
        }
      }
      
      const shiftsWithAssignments = shiftsData.map((shift: any) => {
        const shiftAssignments = assignmentsData 
          ? assignmentsData
              .filter(assignment => assignment.shift_id === shift.id)
              .map(assignment => ({
                ...assignment,
                profiles: technicianProfiles[assignment.technician_id] || null
              }))
          : [];
          
        return {
          ...shift,
          assignments: shiftAssignments
        };
      });

      return shiftsWithAssignments;
    } catch (error: any) {
      console.error("Error fetching shifts:", error);
      toast.error("Could not load shifts: " + error.message);
      return [];
    }
  }, [selectedDate, jobId]);

  const { 
    data: shifts = [], 
    isLoading, 
    isError, 
    error, 
    manualRefresh,
    isRefreshing,
    connectionStatus
  } = useEnhancedQuery(
    ['festival_shifts', jobId, selectedDate],
    fetchShifts,
    'festival_shifts',
    {
      enabled: !!jobId && !!selectedDate,
      staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    }
  );

  return {
    shifts: shifts as ShiftWithAssignments[],
    isLoading,
    isRefreshing,
    connectionStatus,
    error,
    isError,
    refetch: manualRefresh,
  };
}
