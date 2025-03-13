
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface FestivalShift {
  id: string;
  title: string;
  job_id: string;
  start_time: string;
  end_time: string;
  date: string;
  assigned_to?: string[];
  profile_data?: {
    id: string;
    first_name: string;
    last_name: string;
  }[];
}

interface UseFestivalSchedulingResult {
  shifts: FestivalShift[];
  isLoading: boolean;
  error: Error | null;
  refreshShifts: () => Promise<void>;
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  jobDates: Date[];
}

export const useFestivalScheduling = (jobId: string | undefined): UseFestivalSchedulingResult => {
  const [shifts, setShifts] = useState<FestivalShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();

  // Function to fetch job dates
  const fetchJobDates = async () => {
    try {
      if (!jobId) {
        console.error("No jobId provided");
        setJobDates([new Date()]);
        return;
      }

      console.log("Fetching job dates for jobId:", jobId);
      
      // First try to get dates from the job record
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("start_time, end_time")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error("Error fetching job data:", jobError);
        throw jobError;
      }

      // Generate dates for the festival duration
      const startDate = new Date(jobData.start_time);
      const endDate = new Date(jobData.end_time);
      
      if (isValid(startDate) && isValid(endDate)) {
        // Calculate days between start and end (inclusive)
        const dates = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log("Generated job dates:", dates);
        setJobDates(dates);
        
        // Set default selected date to the first date
        if (dates.length > 0 && !selectedDate) {
          setSelectedDate(dates[0]);
        }
      } else {
        // Fallback: check job_date_types table
        const { data: dateTypes, error: dateTypesError } = await supabase
          .from("job_date_types")
          .select("date")
          .eq("job_id", jobId);
          
        if (dateTypesError) {
          console.error("Error fetching date types:", dateTypesError);
          setJobDates([new Date()]);
          return;
        }
        
        if (dateTypes && dateTypes.length > 0) {
          const uniqueDates = Array.from(new Set(
            dateTypes
              .map(dt => {
                try {
                  return new Date(dt.date);
                } catch (e) {
                  return null;
                }
              })
              .filter(date => date && isValid(date))
          )) as Date[];
          
          console.log("Unique dates from job_date_types:", uniqueDates);
          setJobDates(uniqueDates);
          
          // Set default selected date to the first date
          if (uniqueDates.length > 0 && !selectedDate) {
            setSelectedDate(uniqueDates[0]);
          }
        } else {
          console.warn("No valid dates found for this job");
          setJobDates([new Date()]);
          setSelectedDate(new Date());
        }
      }
    } catch (error: any) {
      console.error("Error fetching festival dates:", error);
      setJobDates([new Date()]);
      setSelectedDate(new Date());
    }
  };

  // Function to fetch shifts for the selected date
  const fetchShifts = async () => {
    try {
      setIsLoading(true);
      
      if (!jobId) {
        console.error("No jobId provided");
        return;
      }

      if (!selectedDate) {
        console.log("No date selected, using first job date");
        if (jobDates.length > 0) {
          setSelectedDate(jobDates[0]);
        } else {
          console.warn("No job dates available");
          return;
        }
      }

      // Format the selected date for database query
      const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
      console.log("Fetching shifts for date:", formattedDate);

      if (!formattedDate) {
        console.warn("No formatted date available");
        return;
      }

      // Fetch shifts with assigned crew members
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("festival_shifts")
        .select(`
          *,
          shift_assignments(
            crew_member,
            profiles(id, first_name, last_name)
          )
        `)
        .eq("job_id", jobId)
        .eq("date", formattedDate);

      if (shiftsError) {
        console.error("Error fetching shifts:", shiftsError);
        setError(shiftsError);
        setShifts([]);
        return;
      }

      console.log("Shifts data retrieved:", shiftsData);

      // Transform data to include profile information
      const transformedShifts = shiftsData.map(shift => {
        // Extract profile data from shift_assignments
        const assignedTo = shift.shift_assignments?.map(assignment => assignment.crew_member) || [];
        const profileData = shift.shift_assignments?.map(assignment => assignment.profiles) || [];
        
        return {
          ...shift,
          assigned_to: assignedTo,
          profile_data: profileData
        };
      });

      setShifts(transformedShifts);
      setError(null);
    } catch (error: any) {
      console.error("Error in fetchShifts:", error);
      setError(error);
      setShifts([]);
      toast({
        title: "Error fetching shifts",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Setup subscription for real-time updates
  useEffect(() => {
    if (!jobId) return;
    
    console.log("Setting up shift subscriptions for job:", jobId);
    
    const channel = supabase
      .channel('festival-shifts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'festival_shifts', filter: `job_id=eq.${jobId}` },
        payload => {
          console.log('Festival shift changed:', payload);
          fetchShifts();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'shift_assignments' },
        payload => {
          console.log('Shift assignment changed:', payload);
          fetchShifts();
        }
      )
      .subscribe();
      
    return () => {
      console.log("Cleaning up shift subscriptions");
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  // Fetch job dates on initial load
  useEffect(() => {
    fetchJobDates();
  }, [jobId]);

  // Fetch shifts when selected date changes
  useEffect(() => {
    if (selectedDate) {
      fetchShifts();
    }
  }, [selectedDate, jobId]);

  // Refresh function to manually trigger data refetch
  const refreshShifts = async () => {
    await fetchShifts();
  };

  // Apply tab visibility refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab is now visible, refreshing shifts data');
        fetchShifts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    shifts,
    isLoading,
    error,
    refreshShifts,
    selectedDate,
    setSelectedDate,
    jobDates,
  };
};

// Helper function for date validation
function isValid(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}
