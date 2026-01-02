
import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
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

type AvailabilityStatus = 'vacation' | 'travel' | 'sick' | 'day_off' | 'unavailable' | 'warehouse';

// Global store for availability data - prevents parent rerenders
const availabilityStore = {
  data: {} as Record<string, AvailabilityStatus>,
  listeners: new Set<() => void>(),

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  getSnapshot() {
    return this.data;
  },

  setData(newData: Record<string, AvailabilityStatus>) {
    this.data = newData;
    this.listeners.forEach(listener => listener());
  },

  updateKey(key: string, status: AvailabilityStatus | null) {
    if (status === null) {
      const { [key]: _, ...rest } = this.data;
      this.data = rest;
    } else {
      this.data = { ...this.data, [key]: status };
    }
    this.listeners.forEach(listener => listener());
  }
};

export const useTechnicianAvailability = (currentMonth: Date) => {
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;

  useEffect(() => {
    let isInitialFetch = true;

    const fetchAvailability = async () => {
      // Only set loading on initial fetch, not on real-time updates
      if (isInitialFetch) {
        setIsLoading(true);
      }
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

        const availabilityMap: Record<string, AvailabilityStatus> = {};

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

        // Update global store instead of local state - no parent rerender
        availabilityStore.setData(availabilityMap);
      } catch (error) {
        console.error('TechnicianAvailability: Error in fetchAvailability:', error);
      } finally {
        if (isInitialFetch) {
          setIsLoading(false);
          isInitialFetch = false;
        }
      }
    };

    fetchAvailability();

    // Set up real-time subscription with debouncing to prevent excessive reloads
    let refetchTimeout: NodeJS.Timeout;
    const debouncedRefetch = () => {
      clearTimeout(refetchTimeout);
      refetchTimeout = setTimeout(() => {
        fetchAvailability();
      }, 500); // Debounce by 500ms
    };

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
          debouncedRefetch();
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
          debouncedRefetch();
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
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(refetchTimeout);
      supabase.removeChannel(availabilityChannel);
      supabase.removeChannel(schedulesChannel);
      supabase.removeChannel(vacationRequestsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]); // Only refetch when month boundary changes

  const updateAvailability = useCallback(async (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off' | 'warehouse' | 'unavailable', date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${techId}-${dateStr}`;

    try {
      // No optimistic update here - handled in HouseTechBadge component

      // Handle warehouse status by inserting into availability_schedules
      if (status === 'warehouse') {
        // Get user's department
        const { data: profile } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', techId)
          .single();

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

        if (scheduleError) {
          console.error('TechnicianAvailability: Error updating warehouse status:', scheduleError);

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

      toast({
        title: "Error",
        description: "Failed to update availability status",
        variant: "destructive",
      });
    }
  }, [toast]);

  const removeAvailability = useCallback(async (techId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    try {
      // No optimistic update here - handled in HouseTechBadge component

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
  }, [toast]);

  // Stable function that reads from store - never changes reference
  const getAvailabilityStatus = useCallback((techId: string, date: Date): AvailabilityStatus | null => {
    const key = `${techId}-${format(date, 'yyyy-MM-dd')}`;
    return availabilityStore.data[key] || null;
  }, []);

  return {
    availabilityData: availabilityStore.data,
    isLoading,
    updateAvailability,
    removeAvailability,
    getAvailabilityStatus
  };
};

// Hook for individual badges to subscribe to their specific availability status
// Only rerenders when THIS badge's status changes
export const useAvailabilityStatus = (techId: string, date: Date): AvailabilityStatus | null => {
  const key = `${techId}-${format(date, 'yyyy-MM-dd')}`;

  const subscribe = useCallback((callback: () => void) => {
    return availabilityStore.subscribe(callback);
  }, []);

  const getSnapshot = useCallback(() => {
    return availabilityStore.data[key] || null;
  }, [key]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
