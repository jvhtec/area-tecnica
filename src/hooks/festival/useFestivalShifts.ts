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
  
  // Set up real-time subscriptions for both tables with all change events
  useTableSubscription('festival_shifts', ['festival_shifts', jobId, selectedDate], {
    event: '*',
    schema: 'public',
    filter: `job_id=eq.${jobId}`
  });
  
  useTableSubscription('festival_shift_assignments', ['festival_shift_assignments', jobId, selectedDate], {
    event: '*',
    schema: 'public'
  });

  const fetchShifts = useCallback(async () => {
    if (!selectedDate || !jobId) {
      return [];
    }
    
    try {
      console.log(`Fetching shifts for job: ${jobId}, date: ${selectedDate}`);
      
      // First fetch all shifts for the given job and date
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

      // Get all shift IDs to fetch assignments
      const shiftIds = shiftsData.map(shift => shift.id);
      
      // Fetch assignments with explicit column selection and profile data in a single query
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
        throw assignmentsError;
      }
      
      console.log("Assignments data retrieved:", assignmentsData);

      // Map shifts with their assignments
      const shiftsWithAssignments = shiftsData.map((shift: any) => {
        // Filter and map assignments for this shift
        const shiftAssignments = assignmentsData
          ? assignmentsData
              .filter(assignment => assignment.shift_id === shift.id)
              .map(assignment => ({
                ...assignment,
                // If there's a technician_id, include the profiles data
                // Otherwise this is an external technician and profiles will be null
                profiles: assignment.technician_id ? assignment.profiles : null
              }))
          : [];
          
        return {
          ...shift,
          assignments: shiftAssignments
        };
      });

      console.log("Processed shifts with assignments:", shiftsWithAssignments);
      return shiftsWithAssignments;
      
    } catch (error: any) {
      console.error("Error in fetchShifts:", error);
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
    staleTime: 0, // Consider data immediately stale to ensure fresh data on changes
    refetchOnWindowFocus: true,
    retry: 2
  });

  return {
    shifts: shifts as ShiftWithAssignments[],
    isLoading: queryLoading,
    refetch,
  };
}
