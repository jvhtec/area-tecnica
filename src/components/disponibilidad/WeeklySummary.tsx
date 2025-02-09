
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface WeeklySummaryProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

type EquipmentCategory = 'convencional' | 'robotica' | 'fx' | 'rigging';

interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  stock: number;
}

export function WeeklySummary({ selectedDate, onDateChange }: WeeklySummaryProps) {
  const { session } = useSessionManager();
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(selectedDate));
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem('weeklySummaryOpen');
    return stored ? JSON.parse(stored) : true;
  });
  const [selectedCategories, setSelectedCategories] = useState<EquipmentCategory[]>(['convencional', 'robotica', 'fx', 'rigging']);

  useEffect(() => {
    localStorage.setItem('weeklySummaryOpen', JSON.stringify(isOpen));
  }, [isOpen]);

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
        .order('category')
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

      const assignments = [];
      
      // Fetch all assignments for each day
      for (const date of weekDates) {
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
          .eq('date', format(date, 'yyyy-MM-dd'))
          .order('order', { ascending: true });

        if (error) {
          console.error('Error fetching assignments for date:', date, error);
          continue;
        }

        if (data) {
          assignments.push(...data);
        }
      }

      return assignments;
    },
    enabled: !!session?.user?.id
  });

  // Calculate total used quantities for each equipment per day
  const getUsedQuantity = (equipmentId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAssignments = weekAssignments?.filter(a => a.date === dateStr);
    
    if (!dayAssignments?.length) return 0;

    // Sum up quantities from all presets assigned to this date
    return dayAssignments.reduce((total, assignment) => {
      const item = assignment.preset.items.find(item => 
        item.equipment_id === equipmentId
      );
      return total + (item?.quantity || 0);
    }, 0);
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

  const toggleCategory = (category: EquipmentCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const categoryLabels: Record<EquipmentCategory, string> = {
    convencional: 'Convencional',
    robotica: 'Robótica',
    fx: 'FX',
    rigging: 'Rigging'
  };

  const filteredEquipment = stockWithEquipment?.filter(item => 
    selectedCategories.includes(item.category as EquipmentCategory)
  );

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full space-y-2"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Resumen Semanal</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {Object.entries(categoryLabels).map(([category, label]) => (
              <Button
                key={category}
                variant={selectedCategories.includes(category as EquipmentCategory) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleCategory(category as EquipmentCategory)}
              >
                {label}
              </Button>
            ))}
          </div>
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
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent className="space-y-2">
        <Card className="p-4">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Categoría</TableHead>
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
                {filteredEquipment?.map((item) => {
                  const usedQuantities = weekDates.map(date => getUsedQuantity(item.id, date));
                  const maxUsedInWeek = Math.max(...usedQuantities);
                  const available = item.stock - maxUsedInWeek;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{categoryLabels[item.category as EquipmentCategory]}</TableCell>
                      <TableCell>{item.stock}</TableCell>
                      {weekDates.map((date) => {
                        const used = getUsedQuantity(item.id, date);
                        const remaining = item.stock - used;
                        const remainingText = remaining >= 0 ? `(+${remaining})` : `(${remaining})`;
                        const remainingClass = remaining >= 0 ? 'text-green-500' : 'text-red-500';

                        return (
                          <TableCell 
                            key={date.toISOString()} 
                            className="text-center"
                          >
                            {used > 0 ? (
                              <span className="flex justify-center items-center gap-1">
                                <span className="text-white">{used}</span>
                                <span className={remainingClass}>{remainingText}</span>
                              </span>
                            ) : (
                              '-'
                            )}
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
          </ScrollArea>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

