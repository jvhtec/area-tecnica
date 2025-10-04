
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

  // Fetch current stock levels to check for conflicts
  const { data: stockData } = useQuery({
    queryKey: ['equipment-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_stock_levels')
        .select('*');

      if (error) throw error;
      return data;
    }
  });

  // Fetch all preset assignments for the department (removed user_id filter)
  const { data: presetAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['preset-assignments'],
    queryFn: async () => {
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
        .order('date');

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load preset assignments"
        });
        throw error;
      }

      return data;
    }
  });

  // Mutation to assign preset to date (removed user_id, added assigned_by)
  const assignPresetMutation = useMutation({
    mutationFn: async ({ date, presetId }: { date: Date; presetId: string }) => {
      if (!session?.user?.id) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('day_preset_assignments')
        .insert({
          date: format(date, 'yyyy-MM-dd'),
          preset_id: presetId,
          user_id: session.user.id, // Keep for compatibility
          assigned_by: session.user.id
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

  // Check if a date has equipment conflicts
  const hasConflict = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAssignments = presetAssignments?.filter(a => a.date === dateStr);
    
    if (!dayAssignments?.length || !stockData) return false;

    // Calculate total equipment needed for this date
    const equipmentNeeded: Record<string, number> = {};
    dayAssignments.forEach(assignment => {
      assignment.preset.items.forEach(item => {
        equipmentNeeded[item.equipment_id] = (equipmentNeeded[item.equipment_id] || 0) + item.quantity;
      });
    });

    // Check if any equipment exceeds available stock
    return Object.entries(equipmentNeeded).some(([equipmentId, needed]) => {
      const stock = stockData.find(s => s.equipment_id === equipmentId);
      return needed > (stock?.current_quantity || 0);
    });
  };

  const modifiers = {
    hasPreset: (date: Date) => {
      return presetAssignments?.some(
        assignment => assignment.date === format(date, 'yyyy-MM-dd')
      ) ?? false;
    },
    hasConflict: (date: Date) => hasConflict(date)
  };

  const modifiersStyles = {
    hasPreset: { border: '2px solid hsl(var(--primary))' },
    hasConflict: { backgroundColor: 'hsl(var(--destructive) / 0.2)', border: '2px solid hsl(var(--destructive))' }
  };

  const isLoading = isLoadingAssignments;

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
