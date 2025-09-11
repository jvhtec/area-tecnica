
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AvailabilitySchedule } from '@/types/availability';
import { format } from 'date-fns';
import type { PresetWithItems } from '@/types/equipment';
import { useIsMobile } from '@/hooks/use-mobile';

interface DisponibilidadCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
}

export function DisponibilidadCalendar({ selectedDate, onDateSelect }: DisponibilidadCalendarProps) {
  const { session, userDepartment } = useOptimizedAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

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
    },
    hasPreset: (date: Date) => {
      return presetAssignments?.some(
        assignment => assignment.date === format(date, 'yyyy-MM-dd')
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

  const navigateToToday = () => {
    const today = new Date();
    if (onDateSelect) {
      onDateSelect(today);
    }
  };

  return (
    <Card className="p-4">
      {/* Mobile controls */}
      {isMobile && (
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={navigateToToday}>
            <CalendarIcon className="h-4 w-4 mr-1" />
            Today
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onDateSelect}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
      
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
