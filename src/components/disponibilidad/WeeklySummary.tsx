
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Card } from '@/components/ui/card';

interface WeeklySummaryProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function WeeklySummary({ selectedDate, onDateChange }: WeeklySummaryProps) {
  const { session } = useSessionManager();
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(selectedDate));

  // Get dates for the current week
  const weekDates = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart)
  });

  // Fetch equipment list and stock
  const { data: stockWithEquipment } = useQuery({
    queryKey: ['equipment-with-stock', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data: equipment } = await supabase
        .from('equipment')
        .select('*')
        .order('name');

      const { data: stockEntries } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('user_id', session.user.id);

      if (!equipment) return [];

      // Create a map of equipment quantities
      const stockMap = (stockEntries || []).reduce((acc, entry) => {
        acc[entry.equipment_id] = entry.base_quantity;
        return acc;
      }, {} as Record<string, number>);

      return equipment.map(item => ({
        ...item,
        stock: stockMap[item.id] || 0
      }));
    },
    enabled: !!session?.user?.id
  });

  // Fetch preset assignments for the week
  const { data: weekAssignments } = useQuery({
    queryKey: ['week-preset-assignments', session?.user?.id, currentWeekStart],
    queryFn: async () => {
      if (!session?.user?.id) return [];

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
        .eq('user_id', session.user.id)
        .gte('date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('date', format(endOfWeek(currentWeekStart), 'yyyy-MM-dd'));

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

  // Calculate used quantities for each equipment per day
  const getUsedQuantity = (equipmentId: string, date: Date) => {
    const assignment = weekAssignments?.find(a => 
      a.date === format(date, 'yyyy-MM-dd') &&
      a.preset?.items.some(item => item.equipment_id === equipmentId)
    );

    if (!assignment) return 0;

    const item = assignment.preset.items.find(item => item.equipment_id === equipmentId);
    return item?.quantity || 0;
  };

  const handlePreviousWeek = () => {
    const newDate = subWeeks(currentWeekStart, 1);
    setCurrentWeekStart(newDate);
    onDateChange(newDate);
  };

  const handleNextWeek = () => {
    const newDate = addWeeks(currentWeekStart, 1);
    setCurrentWeekStart(newDate);
    onDateChange(newDate);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Resumen Semanal</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {format(currentWeekStart, "d 'de' MMMM", { locale: es })} - {" "}
            {format(endOfWeek(currentWeekStart), "d 'de' MMMM", { locale: es })}
          </span>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipo</TableHead>
              <TableHead>Stock Total</TableHead>
              {weekDates.map((date) => (
                <TableHead key={date.toISOString()} className="text-center">
                  {format(date, 'EEE d', { locale: es })}
                </TableHead>
              ))}
              <TableHead className="text-right">Disponible</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockWithEquipment?.map((item) => {
              const usedQuantities = weekDates.map(date => getUsedQuantity(item.id, date));
              const maxUsedInWeek = Math.max(...usedQuantities);
              const available = item.stock - maxUsedInWeek;

              return (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.stock}</TableCell>
                  {weekDates.map((date) => {
                    const used = getUsedQuantity(item.id, date);
                    return (
                      <TableCell 
                        key={date.toISOString()} 
                        className={`text-center ${used > item.stock ? 'text-red-500 font-bold' : ''}`}
                      >
                        {used || '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell 
                    className={`text-right ${available < 0 ? 'text-red-500 font-bold' : ''}`}
                  >
                    {available}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
