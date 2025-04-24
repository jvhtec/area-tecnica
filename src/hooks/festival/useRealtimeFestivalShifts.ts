
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useToast } from "@/hooks/use-toast";

interface UseRealtimeFestivalShiftsParams {
  jobId: string;
  selectedDate: string;
}

export function useRealtimeFestivalShifts({ 
  jobId, 
  selectedDate 
}: UseRealtimeFestivalShiftsParams) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchShifts = useCallback(async () => {
    if (!selectedDate || !jobId) {
      return [];
    }
    
    try {
      console.log(`Fetching shifts for job: ${jobId}, date: ${selectedDate}`);
      
      // 1. First fetch all shifts for the given job and date
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("festival_shifts")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("start_time");

      if (shiftsError) throw shiftsError;
      
      if (!shiftsData || shiftsData.length === 0) {
        return [];
      }

      // 2. Get all shift IDs
      const shiftIds = shiftsData.map(shift => shift.id);
      
      // 3. Fetch assignments with technician profiles
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("festival_shift_assignments")
        .select(`
          *,
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

      if (assignmentsError) throw assignmentsError;

      // 4. Map shifts with their assignments
      return shiftsData.map(shift => ({
        ...shift,
        assignments: assignmentsData
          .filter(assignment => assignment.shift_id === shift.id)
      }));
      
    } catch (error: any) {
      console.error("Error in fetchShifts:", error);
      toast({
        title: "Error",
        description: "Failed to load shifts: " + error.message,
        variant: "destructive",
      });
      return [];
    }
  }, [selectedDate, jobId, toast]);

  // Set up realtime subscriptions for both tables
  useRealtimeSubscription('festival_shifts', ['festival_shifts', jobId, selectedDate]);
  useRealtimeSubscription('festival_shift_assignments', ['festival_shifts', jobId, selectedDate]);

  const { 
    data: shifts = [], 
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['festival_shifts', jobId, selectedDate],
    queryFn: fetchShifts,
    enabled: !!jobId && !!selectedDate,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    shifts: shifts as ShiftWithAssignments[],
    isLoading,
    isRefreshing,
    refetch: handleRefresh
  };
}
