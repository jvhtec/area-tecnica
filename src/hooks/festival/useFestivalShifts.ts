
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTableSubscription } from "@/hooks/useTableSubscription";
import { useToast } from "@/hooks/use-toast";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { useQuery, useQueryClient } from "@tanstack/react-query";


import { queryKeys } from "@/lib/react-query";
interface UseFestivalShiftsParams {
  jobId: string;
  selectedDate: string;
}

type ShiftProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department: string | null;
  role: string | null;
};

export function useFestivalShifts({ jobId, selectedDate }: UseFestivalShiftsParams) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);

  // Set up real-time subscriptions for both tables
  useTableSubscription('festival_shifts', queryKeys.scope('festival_shifts', jobId, selectedDate));
  useTableSubscription('festival_shift_assignments', queryKeys.scope('festival_shift_assignments', jobId, selectedDate));

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

      if (shiftsError) {
        console.error("Error fetching shifts:", shiftsError);
        throw shiftsError;
      }

      console.log("Shifts data retrieved:", shiftsData);

      if (!shiftsData || shiftsData.length === 0) {
        return [];
      }

      // 2. Get all shift IDs
      const shiftIds = shiftsData.map(shift => shift.id);

      // 3. Fetch assignments separately
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("festival_shift_assignments")
        .select("*")
        .in("shift_id", shiftIds);

      if (assignmentsError) {
        console.error("Error fetching shift assignments:", assignmentsError);
        throw assignmentsError;
      }

      console.log("Assignments data retrieved:", assignmentsData);

      // 4. For assignments with technicians, fetch their profiles
      const technicianIds = assignmentsData
        .filter(assignment => assignment.technician_id)
        .map(assignment => assignment.technician_id);

      let profilesData: Record<string, ShiftProfile> = {};

      if (technicianIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, department, role")
          .in("id", technicianIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          throw profilesError;
        }

        // Create a map of profiles by ID for easier lookup
        profilesData = profiles.reduce<Record<string, ShiftProfile>>((acc, profile) => ({
          ...acc,
          [profile.id]: profile
        }), {});
      }

      // 5. Map shifts with their assignments and profile data
      const shiftsWithAssignments = shiftsData.map(shift => {
        const shiftAssignments = assignmentsData
          .filter(assignment => assignment.shift_id === shift.id)
          .map(assignment => ({
            ...assignment,
            profiles: assignment.technician_id
              ? profilesData[assignment.technician_id]
              : null
          }));

        return {
          ...shift,
          assignments: shiftAssignments
        };
      });

      console.log("Final processed shifts with assignments:", shiftsWithAssignments);
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
    queryKey: queryKeys.scope('festival_shifts', jobId, selectedDate),
    queryFn: fetchShifts,
    enabled: !!jobId && !!selectedDate,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    retry: 2
  });

  // Enhanced refetch function that also invalidates related queries
  const enhancedRefetch = useCallback(async () => {
    console.log("Enhanced refetch triggered - invalidating queries and refetching");

    // Invalidate all related queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.scope('festival_shifts')
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.scope('festival_shift_assignments')
    });

    // Force refetch
    return await refetch();
  }, [queryClient, refetch]);

  return {
    shifts: shifts as ShiftWithAssignments[],
    isLoading: queryLoading,
    refetch: enhancedRefetch,
  };
}
