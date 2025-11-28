import { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfWeek, isSameDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { QuickPresetAssignment } from '@/components/disponibilidad/QuickPresetAssignment';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MobileAvailabilityViewProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    jobs: any[];
    assignedPresets: any[];
    logoMap: Record<string, string | undefined>;
}

export function MobileAvailabilityView({
    selectedDate,
    onDateSelect,
    jobs,
    assignedPresets,
    logoMap
}: MobileAvailabilityViewProps) {
    const [weekStart, setWeekStart] = useState(startOfWeek(selectedDate, { weekStartsOn: 1 }));
    const scrollRef = useRef<HTMLDivElement>(null);

    // Generate 2 weeks of dates centered around selected date for the strip
    const days = Array.from({ length: 14 }, (_, i) => {
        const start = subDays(selectedDate, 3); // Start 3 days before selected
        return addDays(start, i);
    });

    const handlePrevDay = () => {
        onDateSelect(subDays(selectedDate, 1));
    };

    const handleNextDay = () => {
        onDateSelect(addDays(selectedDate, 1));
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            {/* Date Strip */}
            <div className="bg-[#0f1219] border-b border-[#1f232e] p-2 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-2 px-2">
                    <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-medium text-sm capitalize">
                        {format(selectedDate, 'MMMM yyyy', { locale: es })}
                    </span>
                    <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div
                    ref={scrollRef}
                    className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar snap-x"
                >
                    {days.map((date) => {
                        const isSelected = isSameDay(date, selectedDate);
                        const isToday = isSameDay(date, new Date());

                        return (
                            <button
                                key={date.toISOString()}
                                onClick={() => onDateSelect(date)}
                                className={cn(
                                    "flex flex-col items-center justify-center min-w-[50px] h-[70px] rounded-xl transition-all snap-center border",
                                    isSelected
                                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                                        : "bg-[#1a1d24] border-[#2a2e3b] text-slate-400 hover:bg-[#252932]",
                                    isToday && !isSelected && "border-blue-500/50 text-blue-400"
                                )}
                            >
                                <span className="text-[10px] uppercase font-medium mb-1">
                                    {format(date, 'EEE', { locale: es })}
                                </span>
                                <span className={cn(
                                    "text-xl font-bold",
                                    isSelected ? "text-white" : "text-slate-200"
                                )}>
                                    {format(date, 'd')}
                                </span>
                                {/* Dot indicator if there are jobs */}
                                {/* This would require checking jobs for each day, skipping for performance in this view for now or passing a map */}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                        {format(selectedDate, 'EEEE, d MMMM', { locale: es })}
                    </h2>
                    <Badge variant="outline" className="bg-[#1a1d24] border-[#2a2e3b]">
                        {jobs.length + (assignedPresets?.length || 0)} Eventos
                    </Badge>
                </div>

                {jobs.length > 0 ? (
                    <div className="space-y-3">
                        {jobs.map((job: any) => {
                            const logo = logoMap[job.id];
                            return (
                                <div
                                    key={job.id}
                                    className="bg-[#0f1219] border border-[#1f232e] rounded-xl p-4 flex items-start gap-4 shadow-sm"
                                >
                                    {logo ? (
                                        <img src={logo} alt="logo" className="h-12 w-12 rounded-lg object-cover border border-[#2a2e3b]" />
                                    ) : (
                                        <div className="h-12 w-12 rounded-lg bg-[#1a1d24] flex items-center justify-center border border-[#2a2e3b] text-lg font-bold text-slate-500">
                                            {String(job.title || '?').slice(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-white truncate">{job.title}</h3>
                                        {job.location?.name && (
                                            <p className="text-sm text-slate-400 truncate">{job.location.name}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20">
                                                {format(new Date(job.start_time), 'HH:mm')}
                                            </Badge>
                                            {job.status && (
                                                <Badge variant="outline" className="text-[10px] border-[#2a2e3b] text-slate-400">
                                                    {job.status}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : assignedPresets && assignedPresets.length > 0 ? (
                    <div className="space-y-3">
                        {assignedPresets.map((assignment: any) => {
                            const job = assignment?.preset?.job;
                            const title = job?.title || assignment?.preset?.name;
                            const location = job?.location?.name;
                            const logo = job?.id ? logoMap[job.id] : undefined;

                            return (
                                <div
                                    key={assignment.id}
                                    className="bg-[#0f1219] border border-[#1f232e] rounded-xl p-4 flex items-start gap-4 shadow-sm"
                                >
                                    {logo ? (
                                        <img src={logo} alt="logo" className="h-12 w-12 rounded-lg object-cover border border-[#2a2e3b]" />
                                    ) : (
                                        <div className="h-12 w-12 rounded-lg bg-[#1a1d24] flex items-center justify-center border border-[#2a2e3b] text-lg font-bold text-slate-500">
                                            {String(title || '?').slice(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-white truncate">{title}</h3>
                                        {location && (
                                            <p className="text-sm text-slate-400 truncate">{location}</p>
                                        )}
                                        <div className="mt-2">
                                            <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                                                Preset
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                        <div className="h-16 w-16 rounded-full bg-[#1a1d24] flex items-center justify-center">
                            <CalendarIcon className="h-8 w-8 text-slate-600" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-300">Sin eventos</h3>
                        <p className="text-sm text-slate-500 max-w-[200px]">
                            No hay trabajos ni presets asignados para este día.
                        </p>
                    </div>
                )}
            </div>

            {/* Floating Action Button / Bottom Sheet */}
            <div className="fixed bottom-6 right-6 z-50">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                            size="icon"
                            className="h-14 w-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-500 text-white border-0"
                        >
                            <Plus className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80vh] bg-[#0f1219] border-t border-[#1f232e] rounded-t-2xl">
                        <SheetHeader className="mb-4">
                            <SheetTitle className="text-white">Asignar Preset Rápido</SheetTitle>
                        </SheetHeader>
                        <QuickPresetAssignment
                            selectedDate={selectedDate}
                            className="w-full border-0 shadow-none bg-transparent p-0"
                        />
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
