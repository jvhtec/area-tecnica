
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

export const useTechnicianAvailability = (currentMonth: Date) => {
  const [availabilityData, setAvailabilityData] = useState<Record<string, 'vacation' | 'travel' | 'sick' | 'day_off'>>({});
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

        // Fetch technician_availability
        const { data: availabilityDataRaw, error: availabilityError } = await supabase
          .from('technician_availability')
          .select('*')
          .gte('date', startOfMonthFormatted)
          .lte('date', endOfMonthFormatted);

        if (availabilityError) {
          console.error('TechnicianAvailability: Error fetching availability data:', availabilityError);
          return;
        }

        // Fetch approved vacation_requests
        const { data: vacationRequestsRaw, error: vacationError } = await supabase
          .from('vacation_requests')
          .select('*')
          .eq('status', 'approved')
          .gte('start_date', startOfMonthFormatted)
          .lte('end_date', endOfMonthFormatted);

        if (vacationError) {
          console.error('TechnicianAvailability: Error fetching vacation requests:', vacationError);
          return;
        }

        console.log('TechnicianAvailability: Fetched availability data:', availabilityDataRaw);
        console.log('TechnicianAvailability: Fetched vacation requests:', vacationRequestsRaw);

        const availabilityMap: Record<string, 'vacation' | 'travel' | 'sick' | 'day_off'> = {};

        // Process technician_availability data
        availabilityDataRaw?.forEach((item: TechnicianAvailability) => {
          const key = `${item.technician_id}-${item.date}`;
          availabilityMap[key] = item.status;
        });

        // Process approved vacation_requests data
        vacationRequestsRaw?.forEach((request: any) => { // Using 'any' for now, can define a type later if needed
          let currentDate = new Date(request.start_date);
          const endDate = new Date(request.end_date);

          while (currentDate <= endDate) {
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const key = `${request.technician_id}-${dateStr}`;
            availabilityMap[key] = 'vacation'; // Mark as vacation
            currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
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
      supabase.removeChannel(vacationRequestsChannel);
    };
  }, [currentMonth]);

  const updateAvailability = async (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off', date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${techId}-${dateStr}`;

    try {
      // Optimistic update
      setAvailabilityData(prev => ({
        ...prev,
        [key]: status
      }));

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

      // Show success toast
      const statusText = status === 'vacation' ? 'vacation' : 
                        status === 'travel' ? 'travel' : 
                        status === 'sick' ? 'sick day' : 'day off';
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

      const { error } = await supabase
        .from('technician_availability')
        .delete()
        .eq('technician_id', techId)
        .eq('date', dateStr);

      if (error) {
        console.error('TechnicianAvailability: Error removing availability:', error);
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

  const getAvailabilityStatus = (techId: string, date: Date): 'vacation' | 'travel' | 'sick' | 'day_off' | null => {
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
