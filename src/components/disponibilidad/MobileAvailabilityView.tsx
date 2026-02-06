import { useState, useRef } from 'react';
import { format, addDays, isSameDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Settings, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { QuickPresetAssignment } from '@/components/disponibilidad/QuickPresetAssignment';
import { WeeklySummary } from '@/components/disponibilidad/WeeklySummary';
import { InventoryManagementDialog } from '@/components/equipment/InventoryManagementDialog';
import { PresetManagementDialog } from '@/components/equipment/PresetManagementDialog';
import { SubRentalDialog } from '@/components/equipment/SubRentalDialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTechnicianTheme } from '@/hooks/useTechnicianTheme';

type DisponibilidadDepartment = 'sound' | 'lights';

const DEPARTMENT_LABELS: Record<DisponibilidadDepartment, string> = {
  sound: 'Sonido',
  lights: 'Luces'
};

interface MobileAvailabilityViewProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    jobs: any[];
    assignedPresets: any[];
    logoMap: Record<string, string | undefined>;
    isAdmin: boolean;
    department: DisponibilidadDepartment;
    onDepartmentChange: (dept: DisponibilidadDepartment) => void;
}

export function MobileAvailabilityView({
    selectedDate,
    onDateSelect,
    jobs,
    assignedPresets,
    logoMap,
    isAdmin,
    department,
    onDepartmentChange
}: MobileAvailabilityViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const { theme, isDark } = useTechnicianTheme();
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [showPresetDialog, setShowPresetDialog] = useState(false);
    const [showWeeklySummary, setShowWeeklySummary] = useState(false);

    // Generate 6 days around selected date for the strip (2 before, selected, 3 after)
    const days = Array.from({ length: 6 }, (_, i) => {
        const start = subDays(selectedDate, 2); // Start 2 days before selected
        return addDays(start, i);
    });

    const handlePrevDay = () => {
        onDateSelect(subDays(selectedDate, 1));
    };

    const handleNextDay = () => {
        onDateSelect(addDays(selectedDate, 1));
    };

    return (
        <div className={cn("flex flex-col min-h-screen -mx-3 -mt-4 -mb-[calc(4.5rem+env(safe-area-inset-bottom))]", theme.bg)}>
            {/* Header */}
            <div className={cn("border-b p-4 sticky top-0 z-20", theme.card, theme.divider)}>
                <div className="flex items-center justify-between mb-3">
                    <h1 className={cn("text-lg font-bold", theme.textMain)}>
                        Disponibilidad · {DEPARTMENT_LABELS[department]}
                    </h1>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowWeeklySummary(true)}
                            className="text-xs"
                        >
                            Tabla Semanal
                        </Button>
                        <Sheet open={showActionsMenu} onOpenChange={setShowActionsMenu}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px] bg-[#0f1219] border-l border-[#1f232e]">
                                <SheetHeader className="mb-6">
                                    <SheetTitle className="text-white">Acciones</SheetTitle>
                                </SheetHeader>
                                <div className="space-y-3">
                                {isAdmin && (
                                    <div className="space-y-2 pb-4 border-b border-[#1f232e]">
                                        <p className="text-xs text-slate-400 font-medium uppercase">Departamento</p>
                                        <div className="flex gap-2">
                                            {Object.entries(DEPARTMENT_LABELS).map(([value, label]) => (
                                                <Button
                                                    key={value}
                                                    variant={department === value ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => {
                                                        onDepartmentChange(value as DisponibilidadDepartment);
                                                        setShowActionsMenu(false);
                                                    }}
                                                    className="flex-1"
                                                >
                                                    {label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <p className={cn("text-xs font-medium uppercase mb-3", theme.textMuted)}>Gestión</p>
                                    <div onClick={() => setShowActionsMenu(false)}>
                                        <InventoryManagementDialog />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start gap-2"
                                        onClick={() => {
                                            setShowPresetDialog(true);
                                            setShowActionsMenu(false);
                                        }}
                                    >
                                        <Settings className="h-4 w-4" />
                                        Gestionar Presets
                                    </Button>
                                    <div onClick={() => setShowActionsMenu(false)}>
                                        <SubRentalDialog />
                                    </div>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
            </div>

            {/* Date Strip */}
            <div className={cn("border-b px-2 py-3 sticky top-[64px] z-10", theme.card, theme.divider)}>
                <div className="flex items-center justify-between mb-3 px-2">
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
                    className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar snap-x px-1"
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
                                        : isDark ? "bg-[#1a1d24] border-[#2a2e3b] hover:bg-[#252932]" : "bg-white border-slate-200 hover:bg-slate-50",
                                    isSelected ? "" : theme.textMuted,
                                    isToday && !isSelected && "border-blue-500/50 text-blue-400"
                                )}
                            >
                                <span className="text-[10px] uppercase font-medium mb-1">
                                    {format(date, 'EEE', { locale: es })}
                                </span>
                                <span className={cn(
                                    "text-xl font-bold",
                                    isSelected ? "text-white" : theme.textMain
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
            <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className={cn("text-lg font-semibold", theme.textMain)}>
                        {format(selectedDate, 'EEEE, d MMMM', { locale: es })}
                    </h2>
                    <Badge variant="outline" className={cn(isDark ? "bg-[#1a1d24] border-[#2a2e3b]" : "bg-white border-slate-200")}>
                        {jobs.length + (assignedPresets?.length || 0)} Eventos
                    </Badge>
                </div>

                {jobs.length > 0 ? (
                    <div className="space-y-2">
                        {jobs.map((job: any) => {
                            const logo = logoMap[job.id];
                            return (
                                <div
                                    key={job.id}
                                    className={cn("border rounded-lg p-3 flex items-start gap-3 shadow-sm", theme.card)}
                                >
                                    {logo ? (
                                        <img
                                            src={logo}
                                            alt="logo"
                                            width={40}
                                            height={40}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-10 w-10 rounded-md object-cover border"
                                        />
                                    ) : (
                                        <div className={cn("h-10 w-10 rounded-md flex items-center justify-center border text-base font-bold", isDark ? "bg-[#1a1d24] text-slate-500" : "bg-slate-100 text-slate-600")}>
                                            {String(job.title || '?').slice(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className={cn("text-[15px] font-semibold truncate", theme.textMain)}>{job.title}</h3>
                                        {job.location?.name && (
                                            <p className={cn("text-xs truncate", theme.textMuted)}>{job.location.name}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20">
                                                {format(new Date(job.start_time), 'HH:mm')}
                                            </Badge>
                                            {job.status && (
                                                <Badge variant="outline" className={cn("text-[10px]", theme.textMuted)}>
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
                    <div className="space-y-2">
                        {assignedPresets.map((assignment: any) => {
                            const job = assignment?.preset?.job;
                            const title = job?.title || assignment?.preset?.name;
                            const location = job?.location?.name;
                            const logo = job?.id ? logoMap[job.id] : undefined;

                            return (
                                <div
                                    key={assignment.id}
                                    className={cn("border rounded-lg p-3 flex items-start gap-3 shadow-sm", theme.card)}
                                >
                                    {logo ? (
                                        <img
                                            src={logo}
                                            alt="logo"
                                            width={40}
                                            height={40}
                                            loading="lazy"
                                            decoding="async"
                                            className="h-10 w-10 rounded-md object-cover border"
                                        />
                                    ) : (
                                        <div className={cn("h-10 w-10 rounded-md flex items-center justify-center border text-base font-bold", isDark ? "bg-[#1a1d24] text-slate-500" : "bg-slate-100 text-slate-600")}>
                                            {String(title || '?').slice(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className={cn("text-[15px] font-semibold truncate", theme.textMain)}>{title}</h3>
                                        {location && (
                                            <p className={cn("text-xs truncate", theme.textMuted)}>{location}</p>
                                        )}
                                        <div className="mt-1.5">
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
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                        <div className="h-14 w-14 rounded-full bg-[#1a1d24] flex items-center justify-center">
                            <CalendarIcon className="h-7 w-7 text-slate-600" />
                        </div>
                        <h3 className="text-base font-medium text-slate-300">Sin eventos</h3>
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

            {/* Preset Management Dialog */}
            <PresetManagementDialog
                open={showPresetDialog}
                onOpenChange={setShowPresetDialog}
                selectedDate={selectedDate}
            />

            {/* Weekly Summary Sheet */}
            <Sheet open={showWeeklySummary} onOpenChange={setShowWeeklySummary}>
                <SheetContent
                    side="bottom"
                    className="h-[90vh] bg-[#0f1219] border-t border-[#1f232e] rounded-t-2xl overflow-y-auto"
                >
                    <SheetHeader className="mb-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowWeeklySummary(false)}
                                className="h-8 w-8"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <SheetTitle className="text-white">Resumen Semanal</SheetTitle>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowWeeklySummary(false)}
                            className="h-8 w-8"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </SheetHeader>
                    <div className="pb-6">
                        <WeeklySummary
                            selectedDate={selectedDate}
                            onDateChange={onDateSelect}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
