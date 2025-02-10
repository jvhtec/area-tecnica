import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AvailabilitySchedule } from '@/types/availability';
import { format } from 'date-fns';
import type { PresetWithItems } from '@/types/equipment';
import { useTimezone } from '@/hooks/use-timezone';

interface DisponibilidadCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
}

export function DisponibilidadCalendar({ selectedDate, onDateSelect }: DisponibilidadCalendarProps) {
  const { session, userDepartment } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatDate, convertToLocal, userTimezone } = useTimezone();

  const { data: availabilityData, isLoading: isLoadingAvailability } = useQuery({
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

  // Fetch preset assignments
  const { data: presetAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['preset-assignments', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      
      const { data, error } = await supabase
        .from('day_preset_assignments')
        .select(`
          *,
          preset:presets (
            *,
            items:preset_items (
              *,
              equipment:equipment (*)
            )
          )
        `)
        .eq('user_id', session.user.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load preset assignments"
        });
        throw error;
      }

      return data;
    },
    enabled: !!session?.user?.id
  });

  // Mutation to assign preset to date
  const assignPresetMutation = useMutation({
    mutationFn: async ({ date, presetId }: { date: Date; presetId: string }) => {
      if (!session?.user?.id) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('day_preset_assignments')
        .upsert({
          date: format(date, 'yyyy-MM-dd'),
          preset_id: presetId,
          user_id: session.user.id
        }, {
          onConflict: 'date,user_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preset-assignments'] });
      toast({
        title: "Success",
        description: "Preset assigned successfully"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign preset"
      });
    }
  });

  const modifiers = {
    available: (date: Date) => {
      return availabilityData?.some(
        schedule => 
          schedule.date === formatDate(date, 'yyyy-MM-dd') && 
          schedule.status === 'available'
      ) ?? false;
    },
    unavailable: (date: Date) => {
      return availabilityData?.some(
        schedule => 
          schedule.date === formatDate(date, 'yyyy-MM-dd') && 
          schedule.status === 'unavailable'
      ) ?? false;
    },
    tentative: (date: Date) => {
      return availabilityData?.some(
        schedule => 
          schedule.date === formatDate(date, 'yyyy-MM-dd') && 
          schedule.status === 'tentative'
      ) ?? false;
    },
    hasPreset: (date: Date) => {
      return presetAssignments?.some(
        assignment => assignment.date === formatDate(date, 'yyyy-MM-dd')
      ) ?? false;
    }
  };

  const modifiersStyles = {
    available: { backgroundColor: '#4ade80' },
    unavailable: { backgroundColor: '#f87171' },
    tentative: { backgroundColor: '#fbbf24' },
    hasPreset: { border: '2px solid #6366f1' }  // Indigo border for dates with presets
  };

  const isLoading = isLoadingAvailability || isLoadingAssignments;

  const handleDateSelect = (date: Date | undefined) => {
    if (onDateSelect) {
      onDateSelect(date ? convertToLocal(date) : undefined);
    }
  };

  return (
    <Card className="p-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        className="rounded-md border"
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
        disabled={isLoading}
      />
    </Card>
  );
}
