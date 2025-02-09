
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AvailabilitySchedule } from '@/types/availability';
import { format } from 'date-fns';

interface DisponibilidadCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
}

export function DisponibilidadCalendar({ selectedDate, onDateSelect }: DisponibilidadCalendarProps) {
  const { session, userDepartment } = useSessionManager();
  const { toast } = useToast();

  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ['availability', session?.user?.id, userDepartment],
    queryFn: async () => {
      if (!session?.user?.id || !userDepartment) return null;
      
      const { data, error } = await supabase
        .from('availability_schedules')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('department', userDepartment);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load availability data"
        });
        throw error;
      }

      return data as AvailabilitySchedule[];
    },
    enabled: !!session?.user?.id && !!userDepartment
  });

  const modifiers = {
    available: (date: Date) => {
      return availabilityData?.some(
        schedule => 
          schedule.date === format(date, 'yyyy-MM-dd') && 
          schedule.status === 'available'
      ) ?? false;
    },
    unavailable: (date: Date) => {
      return availabilityData?.some(
        schedule => 
          schedule.date === format(date, 'yyyy-MM-dd') && 
          schedule.status === 'unavailable'
      ) ?? false;
    },
    tentative: (date: Date) => {
      return availabilityData?.some(
        schedule => 
          schedule.date === format(date, 'yyyy-MM-dd') && 
          schedule.status === 'tentative'
      ) ?? false;
    }
  };

  const modifiersStyles = {
    available: { backgroundColor: '#4ade80' },
    unavailable: { backgroundColor: '#f87171' },
    tentative: { backgroundColor: '#fbbf24' }
  };

  return (
    <Card className="p-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onDateSelect}
        className="rounded-md border"
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
        disabled={isLoading}
      />
    </Card>
  );
}
