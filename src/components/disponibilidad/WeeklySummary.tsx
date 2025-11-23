
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsUpDown, Download, Filter } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { exportWeeklySummaryPDF } from '@/lib/weeklySummaryPdfExport';
import { ReloadButton } from '@/components/ui/reload-button';
import { EquipmentCategory, AllCategories, getCategoriesForDepartment, allCategoryLabels } from '@/types/equipment';
import { useDepartment } from '@/contexts/DepartmentContext';
import { useOptimizedTableSubscriptions } from '@/hooks/useOptimizedSubscriptions';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeGetJSON, safeSetJSON } from '@/lib/storage';

interface WeeklySummaryProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  current_quantity: number;
  base_quantity?: number;
  rental_boost?: number;
}

export function WeeklySummary({ selectedDate, onDateChange }: WeeklySummaryProps) {
  const { department } = useDepartment();
  const { session } = useOptimizedAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(selectedDate));

  // Keep the week aligned with the selected date coming from the calendar
  useEffect(() => {
    const newStart = startOfWeek(selectedDate);
    if (newStart.getTime() !== currentWeekStart.getTime()) {
      setCurrentWeekStart(newStart);
    }
  }, [selectedDate]);
  const [isOpen, setIsOpen] = useState(() => safeGetJSON('weeklySummaryOpen', true));
  
  const departmentCategories = getCategoriesForDepartment(department);
  // Filters disabled by default: show all categories until user opts in
  const [filtersEnabled, setFiltersEnabled] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<AllCategories[]>([]);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  useEffect(() => {
    safeSetJSON('weeklySummaryOpen', isOpen);
  }, [isOpen]);

  const weekDates = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart)
  });

  // Realtime: subscribe to tables that affect stock and assignments
  useOptimizedTableSubscriptions([
    { table: 'current_stock_levels', queryKey: ['equipment-with-stock', department], priority: 'high' },
    { table: 'equipment', queryKey: ['equipment-with-stock', department], priority: 'medium' },
    { table: 'sub_rentals', queryKey: ['equipment-with-stock', department], priority: 'high' },
    { table: 'day_preset_assignments', queryKey: ['week-preset-assignments', department, format(currentWeekStart, 'yyyy-MM-dd')], priority: 'high' },
    { table: 'preset_items', queryKey: ['week-preset-assignments', department, format(currentWeekStart, 'yyyy-MM-dd')], priority: 'medium' },
    { table: 'presets', queryKey: ['week-preset-assignments', department, format(currentWeekStart, 'yyyy-MM-dd')], priority: 'low' },
  ]);

  // Fetch base stock (without per-day rentals). We use the view but only read base_quantity.
  const { data: stockWithEquipment = [], refetch: refetchStock } = useQuery({
    queryKey: ['equipment-with-stock', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_availability_with_rentals')
        .select('*')
        .in('category', departmentCategories)
        .order('category')
        .order('equipment_name');

      if (error) {
        console.error('Error fetching equipment with stock:', error);
        throw error;
      }

      return data.map(item => ({
        id: item.equipment_id,
        name: item.equipment_name,
        category: item.category,
        // Treat current_quantity as base stock for weekly calculations
        current_quantity: item.base_quantity || 0,
        base_quantity: item.base_quantity || 0,
        rental_boost: 0
      })) as Equipment[];
    }
  });

  // Fetch sub-rentals overlapping the current week for this department
  const weekStart = startOfWeek(currentWeekStart);
  const weekEnd = endOfWeek(currentWeekStart);

  const { data: weekSubRentals = [], refetch: refetchSubRentals } = useQuery({
    queryKey: ['sub-rentals-week', department, weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sub_rentals')
        .select('equipment_id, quantity, start_date, end_date, department, notes')
        .eq('department', department)
        .lte('start_date', format(weekEnd, 'yyyy-MM-dd'))
        .gte('end_date', format(weekStart, 'yyyy-MM-dd'));

      if (error) {
        console.error('Error fetching sub-rentals for week:', error);
        throw error;
      }
      return data || [];
    }
  });

  // Compute per-day rental boosts by equipment
  const rentalBoostByDay: Record<string, Record<string, number>> = {};
  weekDates.forEach(date => {
    const d = format(date, 'yyyy-MM-dd');
    rentalBoostByDay[d] = {};
  });
  weekSubRentals.forEach((sr: any) => {
    const srStart = new Date(sr.start_date);
    const srEnd = new Date(sr.end_date);
    weekDates.forEach(date => {
      if (date >= srStart && date <= srEnd) {
        const d = format(date, 'yyyy-MM-dd');
        rentalBoostByDay[d][sr.equipment_id] = (rentalBoostByDay[d][sr.equipment_id] || 0) + (sr.quantity || 0);
      }
    });
  });

  const getBoostForDate = (equipmentId: string, date: Date) => {
    const d = format(date, 'yyyy-MM-dd');
    return rentalBoostByDay[d]?.[equipmentId] || 0;
  };

  // Fetch all assignments for the week (removed user_id filter for department-wide view)
  const { data: weekAssignments, refetch: refetchAssignments } = useQuery({
    queryKey: ['week-preset-assignments', department, currentWeekStart],
    queryFn: async () => {
      const assignments = [];
      
      for (const date of weekDates) {
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
          .eq('preset.department', department)
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
    }
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

  const getPresetBreakdown = (equipmentId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAssignments = weekAssignments?.filter(a => a.date === dateStr) || [];
    const rows: { name: string; qty: number }[] = [];
    dayAssignments.forEach((a: any) => {
      const item = a.preset?.items?.find((i: any) => i.equipment_id === equipmentId);
      if (item && item.quantity > 0) {
        rows.push({ name: a.preset?.name ?? 'Preset', qty: item.quantity });
      }
    });
    return rows;
  };

  const getSubRentalBreakdown = (equipmentId: string, date: Date) => {
    return (weekSubRentals || []).filter((sr: any) => {
      return sr.equipment_id === equipmentId && date >= new Date(sr.start_date) && date <= new Date(sr.end_date);
    }).map((sr: any) => ({ qty: sr.quantity as number, notes: sr.notes as string | null }));
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

  const toggleCategory = (category: AllCategories) => {
    setSelectedCategories(prev => {
      // If filters were disabled, enable and start with the clicked category
      if (!filtersEnabled) {
        setFiltersEnabled(true);
        return [category];
      }
      const next = prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category];
      // If user removed the last filter, disable filters to show all again
      if (next.length === 0) setFiltersEnabled(false);
      return next;
    });
  };

  const filteredEquipment = !filtersEnabled
    ? stockWithEquipment
    : stockWithEquipment?.filter(item => selectedCategories.includes(item.category as AllCategories));

  const handleExportPDF = async () => {
    if (!filteredEquipment) return;

    try {
      const pdfRows = filteredEquipment.map(item => {
        const dailyUsage = weekDates.map(date => {
          const used = getUsedQuantity(item.id, date);
          const boost = getBoostForDate(item.id, date);
          const remaining = item.base_quantity + boost - used;
          const presets = getPresetBreakdown(item.id, date);
          const rentals = getSubRentalBreakdown(item.id, date);
          return { used, remaining, date, boost, presets, rentals };
        });

        const available = Math.min(...dailyUsage.map(d => d.remaining));

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
      <div className={cn("flex", isMobile ? "flex-col gap-3" : "items-center justify-between")}>
        <div className={cn("flex items-center", isMobile ? "justify-between" : "gap-2")}>
          <h2 className={cn("font-semibold", isMobile ? "text-base" : "text-lg md:text-lg")}>Resumen Semanal</h2>
          {isMobile && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        
        {/* Category Filters */}
        <div className={cn("flex items-center gap-2", isMobile && "w-full")}>
          {isMobile ? (
            <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 flex-1">
                  <Filter className="h-4 w-4" />
                  Categorías
                  {filtersEnabled && selectedCategories.length > 0 && (
                    <Badge variant="default" className="ml-1 px-2 py-0">
                      {selectedCategories.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Categorías</SheetTitle>
                </SheetHeader>
                <div className="space-y-2">
                  {departmentCategories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategories.includes(category) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleCategory(category)}
                      className="w-full justify-start"
                    >
                      {allCategoryLabels[category]}
                    </Button>
                  ))}
                  {filtersEnabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { 
                        setFiltersEnabled(false); 
                        setSelectedCategories([]); 
                        setCategorySheetOpen(false);
                      }}
                      className="w-full"
                    >
                      Limpiar Filtros
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <>
              <div className="flex gap-2">
                {departmentCategories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategories.includes(category) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCategory(category)}
                  >
                    {allCategoryLabels[category]}
                  </Button>
                ))}
              </div>
              {filtersEnabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFiltersEnabled(false); setSelectedCategories([]); }}
                  title="Disable filters"
                >
                  Clear
                </Button>
              )}
            </>
          )}
        </div>
        
        {/* Week Navigation and Actions */}
        <div className={cn("flex items-center gap-2 flex-wrap", isMobile && "w-full")}>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm whitespace-nowrap">
              {format(currentWeekStart, "d 'de' MMMM", { locale: es })} - {" "}
              {format(endOfWeek(currentWeekStart), "d 'de' MMMM", { locale: es })}
            </span>
            <Button variant="outline" size="sm" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <ReloadButton onReload={handleReload} />
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportPDF}
            className={cn(isMobile && "flex-1")}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          {!isMobile && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
      </div>

      <CollapsibleContent className="space-y-2">
        <Card className={cn(isMobile ? "p-3" : "p-3 sm:p-4")}>
          <div className="overflow-x-auto">
            <div className="min-w-[768px] md:min-w-[960px] lg:min-w-[1120px]">
              <Table>
                <TableHeader className="bg-background">
                  <TableRow>
                    <TableHead className={cn(isMobile && "text-xs")}>Equipo</TableHead>
                    <TableHead className={cn(isMobile && "text-xs")}>Categoría</TableHead>
                    <TableHead className={cn(isMobile && "text-xs")}>Stock Total</TableHead>
                    {weekDates.map((date) => (
                      <TableHead key={date.toISOString()} className={cn("text-center", isMobile && "text-xs")}>
                        {format(date, 'EEE d', { locale: es })}
                      </TableHead>
                    ))}
                    <TableHead className={cn("text-right", isMobile && "text-xs")}>
                      Disponible
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({format(selectedDate || currentWeekStart, 'EEE d', { locale: es })})
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
              </Table>
              <div className="overflow-y-auto max-h-[500px]">
                <Table>
                  <TableBody>
                {filteredEquipment?.map((item) => {
                  const remainingEachDay = weekDates.map(date => {
                    const used = getUsedQuantity(item.id, date);
                    const boost = getBoostForDate(item.id, date);
                    return item.base_quantity + boost - used;
                  });
                  // Disponible should reflect the currently selected date value
                  const selected = selectedDate || currentWeekStart;
                  const usedSel = getUsedQuantity(item.id, selected);
                  const boostSel = getBoostForDate(item.id, selected);
                  const available = item.base_quantity + boostSel - usedSel;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{allCategoryLabels[item.category]}</TableCell>
                      <TableCell>{item.current_quantity}</TableCell>
                      {weekDates.map((date) => {
                        const used = getUsedQuantity(item.id, date);
                        const boost = getBoostForDate(item.id, date);
                        const remaining = item.base_quantity + boost - used;
                        // Show clearer copy: remaining as restan X, shortage as faltan X
                        const remainingText = remaining >= 0
                          ? `(restan ${remaining})`
                          : `(faltan ${Math.abs(remaining)})`;
                        const remainingClass = remaining >= 0 ? 'text-green-600' : 'text-red-600 font-bold';
                        const cellBgClass = remaining < 0 ? 'bg-destructive/20' : '';

                        const presetBreakdown = getPresetBreakdown(item.id, date);
                        const rentalBreakdown = getSubRentalBreakdown(item.id, date);

                        const content = (
                          <div className="flex justify-center items-center">
                            <span className={remainingClass}>{used > 0 ? used : '-'}</span>
                          </div>
                        );

                        return (
                          <TableCell key={date.toISOString()} className={`text-center ${cellBgClass}`}>
                            <TooltipProvider>
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <div>{content}</div>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="center" className="w-72">
                                  <div className="space-y-2">
                                    <div className="text-sm font-medium">{item.name} · {format(date, 'PPP')}</div>
                                    <div className="text-xs text-muted-foreground">Breakdown</div>
                                    {presetBreakdown.length > 0 ? (
                                      <div className="text-sm">
                                        {presetBreakdown.map((p, idx) => (
                                          <div key={idx} className="flex justify-between"><span>{p.name}</span><span>−{p.qty}</span></div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">No presets</div>
                                    )}
                                    {rentalBreakdown.length > 0 && (
                                      <div className="text-sm pt-1 border-t">
                                        <div className="text-xs text-muted-foreground mb-1">Sub‑rentals</div>
                                        {rentalBreakdown.map((r, idx) => (
                                          <div key={idx} className="flex justify-between"><span>+{r.qty}</span><span className="text-xs italic">{r.notes || ''}</span></div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        );
                      })}
                      <TableCell className={`text-right ${available < 0 ? 'text-red-500 font-bold' : ''}`}>
                        <TooltipProvider>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">{available}</span>
                            </TooltipTrigger>
                            <TooltipContent side="left" align="center" className="w-72">
                              <div className="space-y-2">
                                <div className="text-sm font-medium">
                                  {item.name} · {format(selected, 'PPP')}
                                </div>
                                <div className="text-sm">
                                  <div className="flex justify-between"><span>Base</span><span>{item.base_quantity}</span></div>
                                  <div className="flex justify-between"><span>Sub‑rentals</span><span>+{boostSel}</span></div>
                                  <div className="flex justify-between"><span>Usado</span><span>−{usedSel}</span></div>
                                  <div className="flex justify-between font-medium border-t pt-1"><span>Disponible</span><span>{available}</span></div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                  </TableRow>
                  );
                })}
                </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
