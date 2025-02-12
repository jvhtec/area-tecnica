
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsUpDown, Download } from 'lucide-react';
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
import { exportWeeklySummaryPDF } from '@/lib/weeklySummaryPdfExport';
import { ReloadButton } from '@/components/ui/reload-button';
import { EquipmentCategory, EQUIPMENT_CATEGORIES, categoryLabels } from '@/types/equipment';

interface WeeklySummaryProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  current_quantity: number;
}

export function WeeklySummary({ selectedDate, onDateChange }: WeeklySummaryProps) {
  const { session } = useSessionManager();
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(selectedDate));
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem('weeklySummaryOpen');
    return stored ? JSON.parse(stored) : true;
  });
  const [selectedCategories, setSelectedCategories] = useState<EquipmentCategory[]>([...EQUIPMENT_CATEGORIES]);

  useEffect(() => {
    localStorage.setItem('weeklySummaryOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  const weekDates = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart)
  });

  const { data: stockWithEquipment = [], refetch: refetchStock } = useQuery({
    queryKey: ['equipment-with-stock', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      // Using a direct join instead of relationship
      const { data: equipment, error } = await supabase
        .from('equipment')
        .select(`
          *,
          current_quantity:current_stock_levels!equipment_id(current_quantity)
        `)
        .order('category')
        .order('name');

      if (error) {
        console.error('Error fetching equipment with stock:', error);
        throw error;
      }

      return equipment.map(item => ({
        ...item,
        current_quantity: item.current_quantity?.current_quantity || 0
      })) as Equipment[];
    },
    enabled: !!session?.user?.id
  });

  const { data: weekAssignments, refetch: refetchAssignments } = useQuery({
    queryKey: ['week-preset-assignments', session?.user?.id, currentWeekStart],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const assignments = [];
      
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

  const handleReload = async () => {
    await Promise.all([
      refetchStock(),
      refetchAssignments()
    ]);
  };

  const getUsedQuantity = (equipmentId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAssignments = weekAssignments?.filter(a => a.date === dateStr);
    
    if (!dayAssignments?.length) return 0;

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

  const filteredEquipment = stockWithEquipment?.filter(item => 
    selectedCategories.includes(item.category as EquipmentCategory)
  );

  const handleExportPDF = async () => {
    if (!filteredEquipment) return;

    try {
      const pdfRows = filteredEquipment.map(item => {
        const dailyUsage = weekDates.map(date => {
          const used = getUsedQuantity(item.id, date);
          const remaining = item.current_quantity - used;
          return {
            used,
            remaining,
            date
          };
        });

        const maxUsedInWeek = Math.max(...dailyUsage.map(d => d.used));
        const available = item.current_quantity - maxUsedInWeek;

        return {
          name: item.name,
          category: item.category,
          stock: item.current_quantity,
          dailyUsage,
          available
        };
      });

      const blob = await exportWeeklySummaryPDF(currentWeekStart, pdfRows, selectedCategories);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `resumen-semanal-${format(currentWeekStart, 'yyyy-MM-dd')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Exportado",
        description: "El resumen semanal se ha exportado correctamente",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo exportar el PDF",
      });
    }
  };

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
            {EQUIPMENT_CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategories.includes(category) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleCategory(category)}
              >
                {categoryLabels[category]}
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
          <ReloadButton onReload={handleReload} />
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportPDF}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
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
                  const available = item.current_quantity - maxUsedInWeek;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{categoryLabels[item.category]}</TableCell>
                      <TableCell>{item.current_quantity}</TableCell>
                      {weekDates.map((date) => {
                        const used = getUsedQuantity(item.id, date);
                        const remaining = item.current_quantity - used;
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
