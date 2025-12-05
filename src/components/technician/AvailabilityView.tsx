import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Palmtree } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Theme } from './types';

interface AvailabilityBlock {
    id: string;
    technician_id: string;
    date: string;
    status: 'vacation' | 'travel' | 'sick' | 'day_off';
    created_at: string;
}

interface AvailabilityViewProps {
    theme: Theme;
    isDark: boolean;
}

export const AvailabilityView = ({ theme, isDark }: AvailabilityViewProps) => {
    const { user } = useOptimizedAuth();
    const queryClient = useQueryClient();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Fetch unavailability blocks
    const { data: blocks = [], isLoading } = useQuery<AvailabilityBlock[]>({
        queryKey: ['my-unavailability', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('technician_availability')
                .select('id, technician_id, date, status, created_at')
                .eq('technician_id', user.id)
                .order('date', { ascending: true });
            if (error) throw error;
            return (data as AvailabilityBlock[]) || [];
        },
        enabled: !!user?.id,
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (payload: { startDate: string; endDate: string }) => {
            if (!user?.id) return;
            const rows: Array<{ technician_id: string; date: string; status: string }> = [];
            const s = new Date(payload.startDate + 'T00:00');
            const e = new Date(payload.endDate + 'T00:00');
            if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) throw new Error('Invalid date range');

            // Use Spain timezone to avoid date shifting bugs
            // E.g., selecting 2025-01-15 should store as 2025-01-15, not shift to 2025-01-14
            const spanishDateFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/Madrid',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                const dateStr = spanishDateFormatter.format(d);
                rows.push({ technician_id: user.id, date: dateStr, status: 'day_off' });
            }
            const { error } = await supabase
                .from('technician_availability')
                .upsert(rows, { onConflict: 'technician_id,date' });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Fechas marcadas como no disponibles');
            queryClient.invalidateQueries({ queryKey: ['my-unavailability'] });
            setShowAddSheet(false);
            setStartDate('');
            setEndDate('');
        },
        onError: (e: unknown) => {
            const message = e instanceof Error ? e.message : 'No se pudo crear';
            toast.error(message);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('technician_availability').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Disponibilidad restaurada');
            queryClient.invalidateQueries({ queryKey: ['my-unavailability'] });
        },
        onError: (e: unknown) => {
            const message = e instanceof Error ? e.message : 'No se pudo eliminar';
            toast.error(message);
        },
    });

    // Calendar generation
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Check if a day has unavailability
    // Use string comparison to avoid timezone issues when comparing dates
    const getUnavailabilityForDay = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        return blocks.find(b => b.date === dayStr);
    };

    const statusStyles: Record<string, string> = {
        vacation: 'bg-amber-500/20 text-amber-500',
        travel: 'bg-sky-500/20 text-sky-500',
        sick: 'bg-rose-500/20 text-rose-500',
        day_off: 'bg-emerald-500/20 text-emerald-500',
    };

    // Filter blocks to only show dates within the current month displayed in the calendar
    const filteredBlocks = useMemo(() => {
        if (!blocks.length) return [];

        const monthStartDate = startOfMonth(currentMonth);
        const monthEndDate = endOfMonth(currentMonth);

        return blocks.filter(block => {
            const blockDate = new Date(block.date);
            return isWithinInterval(blockDate, { start: monthStartDate, end: monthEndDate });
        });
    }, [blocks, currentMonth]);

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h1 className={`text-2xl font-bold ${theme.textMain}`}>Disponibilidad</h1>
                <Button size="sm" onClick={() => setShowAddSheet(true)}>
                    <Plus size={14} className="mr-1" /> Añadir
                </Button>
            </div>

            {/* Explanation text */}
            <div className={`p-4 rounded-xl border ${theme.card} ${theme.textMuted} text-sm`}>
                <p className="leading-relaxed">
                    <strong className={theme.textMain}>¿Cómo funciona?</strong><br />
                    Marca aquí los días en los que <strong>no estás disponible</strong> para trabajar con nosotros.
                    Esto puede ser por vacaciones, compromisos con otros clientes, o cualquier otro motivo.
                    Así evitamos enviarte ofertas para fechas en las que no puedes trabajar.
                </p>
            </div>

            {/* Calendar */}
            <div className={`p-4 rounded-2xl border ${theme.card}`}>
                <div className="flex justify-between mb-4">
                    <span className={`font-bold ${theme.textMain}`}>
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
                            <ChevronLeft size={16} className={theme.textMuted} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                            <ChevronRight size={16} className={theme.textMuted} />
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-gray-500 mb-2">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <span key={d}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {/* Empty cells for days before month start */}
                    {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-9" />
                    ))}
                    {days.map((day, i) => {
                        const unavailability = getUnavailabilityForDay(day);
                        const isToday = isSameDay(day, new Date());
                        return (
                            <div
                                key={i}
                                className={`h-9 rounded-lg flex items-center justify-center text-sm transition-colors ${isToday
                                    ? 'bg-blue-600 text-white shadow-lg font-bold'
                                    : unavailability
                                        ? statusStyles[unavailability.status] || 'bg-emerald-500/20 text-emerald-500'
                                        : theme.textMuted
                                    }`}
                            >
                                {format(day, 'd')}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Unavailability blocks for the current month */}
            {isLoading ? (
                <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </div>
            ) : filteredBlocks.length === 0 ? (
                <div className={`p-4 rounded-xl border ${theme.card} text-center`}>
                    <p className={`text-sm ${theme.textMuted}`}>
                        No hay fechas marcadas como no disponibles para {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </p>
                </div>
            ) : (
                <ScrollArea className="h-[400px] rounded-xl">
                    <div className="space-y-2 pr-4">
                        {filteredBlocks.map((b) => (
                            <div key={b.id} className={`p-3 rounded-xl border ${theme.card} flex items-center justify-between`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusStyles[b.status] || 'bg-emerald-500/10'}`}>
                                        <Palmtree size={18} />
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${theme.textMain}`}>
                                            {b.status === 'vacation' ? 'Vacaciones' :
                                                b.status === 'travel' ? 'Viaje' :
                                                    b.status === 'sick' ? 'Baja médica' : 'No disponible'}
                                        </div>
                                        <div className={`text-xs ${theme.textMuted}`}>
                                            {format(new Date(b.date), 'PPP', { locale: es })}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteMutation.mutate(b.id)}
                                    disabled={deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 size={16} className={theme.textMuted} />
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}

            {/* Add Sheet */}
            <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
                <SheetContent side="bottom" className={`rounded-t-2xl ${isDark ? 'bg-[#0f1219]' : 'bg-white'}`}>
                    <SheetHeader className="mb-6">
                        <SheetTitle className={theme.textMain}>Marcar no disponible</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                        <div>
                            <label className={`text-xs font-bold uppercase mb-2 block ${theme.textMuted}`}>Fecha inicio</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className={theme.input}
                            />
                        </div>
                        <div>
                            <label className={`text-xs font-bold uppercase mb-2 block ${theme.textMuted}`}>Fecha fin</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className={theme.input}
                            />
                        </div>
                        <Button
                            className="w-full"
                            disabled={!startDate || !endDate || createMutation.isPending}
                            onClick={() => createMutation.mutate({ startDate, endDate })}
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Guardando...
                                </>
                            ) : (
                                'Marcar no disponible'
                            )}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
};
