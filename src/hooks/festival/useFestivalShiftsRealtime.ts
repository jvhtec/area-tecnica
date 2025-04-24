
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTableSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { ShiftWithAssignments } from "@/types/festival-scheduling";

interface UseFestivalShiftsRealtimeParams {
  jobId: string;
  selectedDate: string;
}

export function useFestivalShiftsRealtime({ 
  jobId, 
  selectedDate 
}: UseFestivalShiftsRealtimeParams) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Set up real-time subscriptions for shifts and assignments
  useTableSubscription('festival_shifts', ['festival_shifts', jobId, selectedDate], {
    event: '*',
    schema: 'public',
    filter: `job_id=eq.${jobId} AND date=eq.${selectedDate}`
  });

  useTableSubscription('festival_shift_assignments', ['festival_shifts', jobId, selectedDate], {
    event: '*',
    schema: 'public'
  });

  const fetchShifts = useCallback(async () => {
    try {
      console.log(`Fetching shifts for job: ${jobId}, date: ${selectedDate}`);
      
      // Fetch shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("festival_shifts")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("start_time");

      if (shiftsError) throw shiftsError;
      
      if (!shiftsData || shiftsData.length === 0) return [];

      // Fetch assignments with technician profiles
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("festival_shift_assignments")
        .select(`
          *,
          profiles:technician_id (
            id, first_name, last_name, email, department, role
          )
        `)
        .in("shift_id", shiftsData.map(shift => shift.id));

      if (assignmentsError) throw assignmentsError;

      // Map shifts with their assignments
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
