
import { useMemo, useState, useEffect } from 'react';
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
import { getCategoriesForDepartment, type Department } from '@/types/equipment';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DayProps } from 'react-day-picker';
import { useRef } from 'react';
import { useDayRender } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface DisponibilidadCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
}

export function DisponibilidadCalendar({ selectedDate, onDateSelect }: DisponibilidadCalendarProps) {
  const { session, userDepartment } = useOptimizedAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const department = (userDepartment || 'sound') as Department;
  const departmentCategories = getCategoriesForDepartment(department);

  // Fetch equipment base stock (base_quantity) for this department's categories
  const { data: stockData } = useQuery({
    queryKey: ['equipment-base-stock', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_availability_with_rentals')
        .select('equipment_id, equipment_name, category, base_quantity')
        .in('category', departmentCategories as string[])
        .order('category')
        .order('equipment_name');

      if (error) throw error;
      return data;
    }
  });

  // Fetch all preset assignments for the department (removed user_id filter)
  const { data: presetAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['preset-assignments', userDepartment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('day_preset_assignments')
        .select(`
          *,
          preset:presets!inner (
            *,
            items:preset_items (
              *,
              equipment:equipment (*)
            )
          )
        `)
        .eq('preset.department', (userDepartment || '').toString())
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

  // Determine date range from assignments to scope sub-rentals query
  const [assignmentsRange, setAssignmentsRange] = useState<{ start?: string; end?: string }>({});
  useEffect(() => {
    if (!presetAssignments || presetAssignments.length === 0) {
      setAssignmentsRange({});
      return;
    }
    const dates = presetAssignments.map((a: any) => new Date(a.date));
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    const start = format(min, 'yyyy-MM-dd');
    const end = format(max, 'yyyy-MM-dd');
    setAssignmentsRange({ start, end });
  }, [presetAssignments]);

  // Fetch sub-rentals overlapping the assignments range for this department
  const { data: subRentals = [] } = useQuery({
    queryKey: ['sub-rentals-range', userDepartment, assignmentsRange.start, assignmentsRange.end],
    queryFn: async () => {
      if (!assignmentsRange.start || !assignmentsRange.end) return [] as any[];
      const { data, error } = await supabase
        .from('sub_rentals')
        .select('equipment_id, quantity, start_date, end_date, department')
        .eq('department', (userDepartment || '').toString())
        .lte('start_date', assignmentsRange.end)
        .gte('end_date', assignmentsRange.start);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(assignmentsRange.start && assignmentsRange.end && userDepartment)
  });

  // Precompute rental boost per date
  const rentalBoostByDay: Record<string, Record<string, number>> = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    if (!subRentals?.length || !assignmentsRange.start || !assignmentsRange.end) return map;
    const start = new Date(assignmentsRange.start);
    const end = new Date(assignmentsRange.end);
    // Iterate by day across range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      map[format(d, 'yyyy-MM-dd')] = {};
    }
    subRentals.forEach((sr: any) => {
      const srStart = new Date(sr.start_date);
      const srEnd = new Date(sr.end_date);
      for (let d = new Date(srStart); d <= srEnd; d.setDate(d.getDate() + 1)) {
        const key = format(d, 'yyyy-MM-dd');
        if (!(key in map)) continue;
        map[key][sr.equipment_id] = (map[key][sr.equipment_id] || 0) + (sr.quantity || 0);
      }
    });
    return map;
  }, [subRentals, assignmentsRange.start, assignmentsRange.end]);

  // Compute day-level classification accounting for sub-rentals
  type DayStatus = 'none' | 'stock_ok' | 'rentals_ok' | 'conflict';
  const getDayStatus = (date: Date): DayStatus => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAssignments = presetAssignments?.filter((a: any) => a.date === dateStr);
    if (!dayAssignments?.length || !stockData) return 'none';

    const equipmentNeeded: Record<string, number> = {};
    dayAssignments.forEach((assignment: any) => {
      assignment.preset.items.forEach((item: any) => {
        equipmentNeeded[item.equipment_id] = (equipmentNeeded[item.equipment_id] || 0) + (item.quantity || 0);
      });
    });

    let anyUsesRentals = false;
    for (const [equipmentId, needed] of Object.entries(equipmentNeeded)) {
      const stockRow = stockData.find((s: any) => s.equipment_id === equipmentId);
      const base = stockRow?.base_quantity ?? 0;
      const boost = rentalBoostByDay[dateStr]?.[equipmentId] ?? 0;
      if (needed > base + boost) return 'conflict';
      if (needed > base) anyUsesRentals = true;
    }
    return anyUsesRentals ? 'rentals_ok' : 'stock_ok';
  };

  const modifiers = {
    hasPreset: (date: Date) => {
      return presetAssignments?.some(
        (assignment: any) => assignment.date === format(date, 'yyyy-MM-dd')
      ) ?? false;
    },
    conflict: (date: Date) => getDayStatus(date) === 'conflict',
    rentals_ok: (date: Date) => getDayStatus(date) === 'rentals_ok',
    stock_ok: (date: Date) => getDayStatus(date) === 'stock_ok',
  };

  const modifiersStyles = {
    hasPreset: { boxShadow: 'inset 0 0 0 2px hsl(var(--primary))' },
    conflict: { backgroundColor: 'hsl(var(--destructive) / 0.22)', border: '2px solid hsl(var(--destructive))' },
    rentals_ok: { backgroundColor: 'hsl(var(--warning, 45 93% 47%) / 0.18)', border: '2px solid hsl(var(--warning, 45 93% 47%))' },
    stock_ok: { backgroundColor: 'hsl(var(--success, 142 71% 45%) / 0.18)', border: '2px solid hsl(var(--success, 142 71% 45%))' },
  } as const;

  // Keep calendar interactive even during loading to avoid blocking selection
  // const isLoading = isLoadingAssignments;

  // Build quick info for tooltips (preset names + conflict status)
  const infoByDate = useMemo(() => {
    const map: Record<string, { names: string[]; count: number; status: DayStatus } > = {};
    (presetAssignments || []).forEach((a: any) => {
      const key = a.date;
      if (!map[key]) map[key] = { names: [], count: 0, status: 'none' };
      map[key].count += 1;
      if (a?.preset?.name) map[key].names.push(a.preset.name);
    });
    Object.keys(map).forEach(d => { map[d].status = getDayStatus(new Date(d)); });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetAssignments, stockData, rentalBoostByDay]);

  // Custom Day with hover details
  function DayWithHover(props: DayProps) {
    const { date, displayMonth } = props;
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dayRender = useDayRender(date, displayMonth, buttonRef);

    if (dayRender.isHidden) {
      return <div role="gridcell" />;
    }

    const key = format(date, 'yyyy-MM-dd');
    const info = infoByDate[key];
    const hasData = !!info;

    if (!dayRender.isButton) {
      return <div {...dayRender.divProps} />;
    }

    return (
      <TooltipProvider>
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <button
              ref={buttonRef}
              {...dayRender.buttonProps}
              className={cn(dayRender.buttonProps.className)}
              title={undefined}
            />
          </TooltipTrigger>
          {hasData && (
            <TooltipContent side="top" align="center" className="w-64">
              <div className="space-y-2">
                <div className="text-sm font-medium">{format(date, 'PPP')}</div>
                <div className="text-sm">Presets: {info.count}</div>
                {info.names.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {info.names.map((n, i) => (<div key={i}>• {n}</div>))}
                  </div>
                )}
                {info.status === 'conflict' && (
                  <div className="text-xs text-red-600 font-medium">Conflicts detected</div>
                )}
                {info.status === 'rentals_ok' && (
                  <div className="text-xs text-amber-600 font-medium">Covered via sub‑rentals</div>
                )}
                {info.status === 'stock_ok' && (
                  <div className="text-xs text-green-600 font-medium">Covered by stock</div>
                )}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  const navigateToToday = () => {
    const today = new Date();
    if (onDateSelect) {
      onDateSelect(today);
    }
  };

  return (
    <Card className="inline-block p-2 md:p-3">
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
        className="w-fit mx-auto rounded-md border"
        classNames={{
          caption: "flex justify-center pt-1 relative items-center",
          table: "w-fit border-collapse space-y-1",
        }}
        components={{ Day: DayWithHover }}
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
      />
    </Card>
  );
}
