
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface TechnicianAvailability {
  id: string;
  technician_id: string;
  date: string;
  status: 'vacation' | 'travel' | 'sick' | 'day_off';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface AvailabilitySchedule {
  id: string;
  user_id: string;
  department: string;
  date: string;
  status: 'available' | 'unavailable' | 'tentative';
  notes?: string;
  source: string;
  source_id?: string;
  created_at: string;
  updated_at: string;
}

export const useTechnicianAvailability = (currentMonth: Date) => {
  const [availabilityData, setAvailabilityData] = useState<Record<string, 'vacation' | 'travel' | 'sick' | 'day_off' | 'unavailable' | 'warehouse'>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAvailability = async () => {
      setIsLoading(true);
      console.log('TechnicianAvailability: Fetching availability data for month:', currentMonth);
      
      try {
        // Get start and end of month to fetch relevant data
        const startOfMonthFormatted = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), 'yyyy-MM-dd');
        const endOfMonthFormatted = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

        // Fetch technician_availability (legacy)
        const { data: availabilityDataRaw, error: availabilityError } = await supabase
          .from('technician_availability')
          .select('*')
          .gte('date', startOfMonthFormatted)
          .lte('date', endOfMonthFormatted);

        if (availabilityError) {
          console.error('TechnicianAvailability: Error fetching availability data:', availabilityError);
          return;
        }

        // Fetch availability_schedules (new system with vacation integration)
        const { data: schedulesData, error: schedulesError } = await supabase
          .from('availability_schedules')
          .select('*')
          .gte('date', startOfMonthFormatted)
          .lte('date', endOfMonthFormatted);

        if (schedulesError) {
          console.error('TechnicianAvailability: Error fetching schedules data:', schedulesError);
          return;
        }

        console.log('TechnicianAvailability: Fetched availability data:', availabilityDataRaw);
        console.log('TechnicianAvailability: Fetched schedules data:', schedulesData);

        const availabilityMap: Record<string, 'vacation' | 'travel' | 'sick' | 'day_off' | 'unavailable' | 'warehouse'> = {};

        // Process legacy technician_availability data
        availabilityDataRaw?.forEach((item: TechnicianAvailability) => {
          const key = `${item.technician_id}-${item.date}`;
          availabilityMap[key] = item.status;
        });

        // Process new availability_schedules data (includes vacation-based unavailability)
        schedulesData?.forEach((item: AvailabilitySchedule) => {
          const key = `${item.user_id}-${item.date}`;
          if (item.status === 'unavailable') {
            // Check if it's vacation-based unavailability
            if (item.source === 'vacation') {
              availabilityMap[key] = 'vacation';
            } else if (item.source === 'warehouse') {
              availabilityMap[key] = 'warehouse';
            } else {
              availabilityMap[key] = 'unavailable';
            }
          }
        });

        setAvailabilityData(availabilityMap);
      } catch (error) {
        console.error('TechnicianAvailability: Error in fetchAvailability:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();

    // Set up real-time subscription for both tables
    const availabilityChannel = supabase
      .channel('technician-availability-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'technician_availability'
        },
        () => {
          console.log('TechnicianAvailability: Real-time update received from technician_availability, refetching data');
          fetchAvailability();
        }
      )
      .subscribe();

    const schedulesChannel = supabase
      .channel('availability-schedules-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_schedules'
        },
        () => {
          console.log('TechnicianAvailability: Real-time update received from availability_schedules, refetching data');
          fetchAvailability();
        }
      )
      .subscribe();

    const vacationRequestsChannel = supabase
      .channel('vacation-requests-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vacation_requests'
        },
        () => {
          console.log('TechnicianAvailability: Real-time update received from vacation_requests, refetching data');
          fetchAvailability();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(availabilityChannel);
      supabase.removeChannel(schedulesChannel);
      supabase.removeChannel(vacationRequestsChannel);
    };
  }, [currentMonth]);

  const updateAvailability = async (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse', date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${techId}-${dateStr}`;

    try {
      // Optimistic update
      setAvailabilityData(prev => ({
        ...prev,
        [key]: status
      }));

      // Handle warehouse status by inserting into availability_schedules
      if (status === 'warehouse') {
        console.log('TechnicianAvailability: Setting warehouse status for', techId, 'on', dateStr);
        
        // Get user's department
        const { data: profile } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', techId)
          .single();

        console.log('TechnicianAvailability: Profile data:', profile);

        const { error: scheduleError } = await supabase
          .from('availability_schedules')
          .upsert({
            user_id: techId,
            department: profile?.department || 'unknown',
            date: dateStr,
            status: 'unavailable',
            source: 'warehouse',
            notes: 'Warehouse override'
          }, {
            onConflict: 'user_id,department,date'
          });

        console.log('TechnicianAvailability: Warehouse upsert result:', { error: scheduleError });

        if (scheduleError) {
          console.error('TechnicianAvailability: Error updating warehouse status:', scheduleError);
          // Revert optimistic update
          setAvailabilityData(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
          });
          
          toast({
            title: "Error",
            description: "Failed to update warehouse status",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Handle other statuses with legacy table
        const { error } = await supabase
          .from('technician_availability')
          .upsert({
            technician_id: techId,
            date: dateStr,
            status,
            created_by: (await supabase.auth.getUser()).data.user?.id
          }, {
            onConflict: 'technician_id,date'
          });

        if (error) {
          console.error('TechnicianAvailability: Error updating availability:', error);
          // Revert optimistic update
          setAvailabilityData(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
          });
          
          toast({
            title: "Error",
            description: "Failed to update availability status",
            variant: "destructive",
          });
          return;
        }
      }

      // Show success toast
      const statusText = status === 'vacation' ? 'vacation' : 
                        status === 'travel' ? 'travel' : 
                        status === 'sick' ? 'sick day' : 
                        status === 'warehouse' ? 'warehouse override' : 'day off';
      toast({
        title: "Availability Updated",
        description: `Technician marked as ${statusText} for ${format(date, 'MMM d, yyyy')}`,
      });
    } catch (error) {
      console.error('TechnicianAvailability: Error in updateAvailability:', error);
      // Revert optimistic update
      setAvailabilityData(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
      
      toast({
        title: "Error",
        description: "Failed to update availability status",
        variant: "destructive",
      });
    }
  };

  const removeAvailability = async (techId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${techId}-${dateStr}`;

    try {
      // Optimistic update
      setAvailabilityData(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });

      // Remove from both tables to ensure cleanup
      const { error: legacyError } = await supabase
        .from('technician_availability')
        .delete()
        .eq('technician_id', techId)
        .eq('date', dateStr);

      const { error: scheduleError } = await supabase
        .from('availability_schedules')
        .delete()
        .eq('user_id', techId)
        .eq('date', dateStr)
        .in('source', ['manual', 'warehouse']); // Only remove manual/warehouse entries, not vacation

      if (legacyError || scheduleError) {
        console.error('TechnicianAvailability: Error removing availability:', legacyError || scheduleError);
        toast({
          title: "Error",
          description: "Failed to remove availability status",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Availability Removed",
        description: `Availability status removed for ${format(date, 'MMM d, yyyy')}`,
      });
    } catch (error) {
      console.error('TechnicianAvailability: Error in removeAvailability:', error);
      toast({
        title: "Error",
        description: "Failed to remove availability status",
        variant: "destructive",
      });
    }
  };

  const getAvailabilityStatus = (techId: string, date: Date): 'vacation' | 'travel' | 'sick' | 'day_off' | 'unavailable' | 'warehouse' | null => {
    const key = `${techId}-${format(date, 'yyyy-MM-dd')}`;
    return availabilityData[key] || null;
  };

  return {
    availabilityData,
    isLoading,
    updateAvailability,
    removeAvailability,
    getAvailabilityStatus
  };
};
