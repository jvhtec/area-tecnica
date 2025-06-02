
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface TechnicianAvailability {
  id: string;
  technician_id: string;
  date: string;
  status: 'vacation' | 'travel' | 'sick';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export const useTechnicianAvailability = (currentMonth: Date) => {
  const [availabilityData, setAvailabilityData] = useState<Record<string, 'vacation' | 'travel' | 'sick'>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAvailability = async () => {
      setIsLoading(true);
      console.log('TechnicianAvailability: Fetching availability data for month:', currentMonth);
      
      try {
        // Get start and end of month to fetch relevant data
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

        const { data, error } = await supabase
          .from('technician_availability')
          .select('*')
          .gte('date', format(startOfMonth, 'yyyy-MM-dd'))
          .lte('date', format(endOfMonth, 'yyyy-MM-dd'));

        if (error) {
          console.error('TechnicianAvailability: Error fetching data:', error);
          return;
        }

        console.log('TechnicianAvailability: Fetched data:', data);

        // Transform data to match the expected format
        const availabilityMap: Record<string, 'vacation' | 'travel' | 'sick'> = {};
        data?.forEach((item: TechnicianAvailability) => {
          const key = `${item.technician_id}-${item.date}`;
          availabilityMap[key] = item.status;
        });

        setAvailabilityData(availabilityMap);
      } catch (error) {
        console.error('TechnicianAvailability: Error in fetchAvailability:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();

    // Set up real-time subscription
    const channel = supabase
      .channel('technician-availability-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'technician_availability'
        },
        () => {
          console.log('TechnicianAvailability: Real-time update received, refetching data');
          fetchAvailability();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMonth]);

  const updateAvailability = async (techId: string, status: 'vacation' | 'travel' | 'sick', date: Date) => {
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
      const statusText = status === 'vacation' ? 'vacation' : status === 'travel' ? 'travel' : 'sick day';
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

  const getAvailabilityStatus = (techId: string, date: Date): 'vacation' | 'travel' | 'sick' | null => {
    const key = `${techId}-${format(date, 'yyyy-MM-dd')}`;
    return availabilityData[key] || null;
  };

  return {
    availabilityData,
    isLoading,
    updateAvailability,
    getAvailabilityStatus
  };
};
