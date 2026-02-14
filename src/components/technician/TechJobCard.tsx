import React, { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { MapPin, Clock, User, FileText, Lightbulb, Receipt } from 'lucide-react';
import { labelForCode } from '@/utils/roles';
import { TechnicianIncidentReportDialog } from '@/components/incident-reports/TechnicianIncidentReportDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useExpensePermissions, isPermissionActive } from '@/hooks/useExpensePermissions';
import { useJobExpenses } from '@/hooks/useJobExpenses';
import { ExpenseForm, ExpenseList, ExpenseSummaryCard } from '@/components/expenses';
import { JobCardProps } from './types';

export const TechJobCard = ({ job, theme, isDark, onAction, isCrewChief, techName, onOpenObliqueStrategy }: JobCardProps) => {
    const jobData = job.jobs || job;
    const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);

    // Expense permissions check
    const { data: expensePermissions = [] } = useExpensePermissions(jobData?.id);
    const hasActiveExpensePermissions = expensePermissions.some(p => isPermissionActive(p));
    const { data: expenses = [] } = useJobExpenses(hasActiveExpensePermissions ? jobData?.id : undefined);
    const jobTimezone = jobData?.timezone || 'Europe/Madrid';

    // Format time
    let timeDisplay = "";
    if (jobData?.start_time && jobData?.end_time) {
        try {
            const startTime = formatInTimeZone(new Date(jobData.start_time), jobTimezone, "HH:mm");
            const endTime = formatInTimeZone(new Date(jobData.end_time), jobTimezone, "HH:mm");
            timeDisplay = `${startTime} - ${endTime}`;
        } catch {
            timeDisplay = "Hora no disponible";
        }
    }

    // Get role label
    let roleLabel = "Técnico";
    if (job.sound_role) roleLabel = labelForCode(job.sound_role) || job.sound_role;
    else if (job.lights_role) roleLabel = labelForCode(job.lights_role) || job.lights_role;
    else if (job.video_role) roleLabel = labelForCode(job.video_role) || job.video_role;
    else if (job.role) roleLabel = job.role;

    const location = jobData?.location?.name || 'Sin ubicación';

    // Status color
    const statusColors: Record<string, string> = {
        'production': 'border-l-emerald-500',
        'planning': 'border-l-blue-500',
        'confirmed': 'border-l-emerald-500',
        'pending': 'border-l-amber-500',
    };
    const statusColor = statusColors[jobData?.status] || 'border-l-blue-500';

    // Job type determines which actions are available
    const jobType = jobData?.job_type?.toLowerCase() || '';
    const isTourdate = jobType === 'tourdate';
    const isDryhire = jobType === 'dryhire' || jobType === 'dry_hire';
    const showTimesheetButton = !isTourdate && !isDryhire;
    const showIncidentReport = !isDryhire;

    return (
        <div className={`rounded-xl border border-l-4 ${statusColor} ${theme.card} p-5 relative overflow-hidden group mb-4`}>

            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-lg ${theme.textMain}`}>{jobData?.title || 'Sin título'}</h3>
                        {isCrewChief && onOpenObliqueStrategy && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onOpenObliqueStrategy(); }}
                                className="text-purple-500/40 hover:text-purple-400 transition-colors p-1"
                                title="Estrategias Oblicuas"
                            >
                                <Lightbulb size={16} />
                            </button>
                        )}
                    </div>
                    <div className={`text-xs ${theme.textMuted} flex items-center gap-2 mt-1`}>
                        <MapPin size={12} /> {location}
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${theme.success}`}>
                    Activo
                </span>
            </div>

            {/* Time & Role */}
            <div className="flex items-center gap-4 text-xs text-gray-400 mb-5 flex-wrap">
                {timeDisplay && (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${isDark ? 'bg-white/5 border border-white/5' : 'bg-slate-100 border border-slate-200'}`}>
                        <Clock size={12} /> {timeDisplay}
                    </div>
                )}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${isDark ? 'bg-white/5 border border-white/5' : 'bg-slate-100 border border-slate-200'}`}>
                    <User size={12} /> {roleLabel}
                </div>
            </div>

            {/* Action Grid */}
            <div className={`grid gap-3 ${showTimesheetButton ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                    onClick={() => onAction('details', jobData)}
                    className={`py-2.5 rounded-lg border border-dashed ${theme.divider} ${theme.textMuted} text-xs font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2`}
                >
                    <FileText size={14} /> Ver detalles
                </button>
                {showTimesheetButton && (
                    <button
                        onClick={() => onAction('timesheet', jobData)}
                        className={`py-2.5 rounded-lg ${theme.accent} text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20`}
                    >
                        <Clock size={14} /> Horas
                    </button>
                )}
                {showIncidentReport && (
                    <TechnicianIncidentReportDialog
                        job={jobData}
                        techName={techName || ''}
                        labeled
                        className={showTimesheetButton ? 'col-span-2' : ''}
                        theme={theme}
                        isDark={isDark}
                    />
                )}
                {hasActiveExpensePermissions && (
                    <button
                        onClick={() => setExpenseDialogOpen(true)}
                        className={`py-2.5 rounded-lg border border-dashed ${theme.divider} ${theme.textMuted} text-xs font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2 ${showTimesheetButton ? 'col-span-2' : ''}`}
                    >
                        <Receipt size={14} /> Gastos
                    </button>
                )}
            </div>

            {/* Expense Dialog */}
            <Dialog open={expenseDialogOpen} onOpenChange={(open) => { setExpenseDialogOpen(open); if (!open) setShowExpenseForm(false); }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Mis Gastos — {jobData?.title || 'Sin título'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Button
                                onClick={() => setShowExpenseForm(!showExpenseForm)}
                                variant={showExpenseForm ? "outline" : "default"}
                                size="sm"
                            >
                                {showExpenseForm ? "Cerrar" : "Nuevo Gasto"}
                            </Button>
                        </div>
                        {showExpenseForm && (
                            <ExpenseForm
                                jobId={jobData.id}
                                onSuccess={() => setShowExpenseForm(false)}
                                onCancel={() => setShowExpenseForm(false)}
                            />
                        )}
                        <ExpenseSummaryCard expenses={expenses} />
                        <ExpenseList expenses={expenses} showActions />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
