import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTableSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { useQuery } from "@tanstack/react-query";

interface UseFestivalShiftsParams {
  jobId: string;
  selectedDate: string;
}

export function useFestivalShifts({ jobId, selectedDate }: UseFestivalShiftsParams) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  // Set up real-time subscriptions for festival shifts and assignments
  useTableSubscription('festival_shifts', ['festival_shifts', jobId, selectedDate]);
  useTableSubscription('festival_shift_assignments', ['festival_shift_assignments', jobId, selectedDate]);

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
          external_technician_name,
          role,
          profiles:technician_id (
            id,
            first_name,
            last_name,
            email,
            department,
            role
          )
        `)
        .in("shift_id", shiftIds);

      if (assignmentsError) {
        console.error("Error fetching shift assignments:", assignmentsError);
        // Continue with empty assignments
      }
      
      const shiftsWithAssignments = shiftsData.map((shift: any) => {
        const shiftAssignments = assignmentsData 
          ? assignmentsData
              .filter(assignment => assignment.shift_id === shift.id)
              .map(assignment => ({
                ...assignment,
                // Keep profiles data if it exists (internal technician)
                profiles: assignment.technician_id ? assignment.profiles : null
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
      toast({
        title: "Error",
        description: "Could not load shifts: " + error.message,
        variant: "destructive",
      });
      
      return [];
    }
  }, [selectedDate, jobId, toast]);

  const { data: shifts = [], isLoading: queryLoading, refetch } = useQuery({
    queryKey: ['festival_shifts', jobId, selectedDate],
    queryFn: fetchShifts,
    enabled: !!jobId && !!selectedDate,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: true
  });

  return {
    shifts: shifts as ShiftWithAssignments[],
    isLoading: queryLoading,
    refetch,
  };
}
