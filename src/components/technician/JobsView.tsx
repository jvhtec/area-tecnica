import React, { useState } from 'react';
import { addWeeks, addMonths } from 'date-fns';
import { Loader2, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getCategoryFromAssignment } from '@/utils/roleCategory';
import { TechJobCard } from './TechJobCard';
import { Theme } from './types';

interface JobsViewProps {
    theme: Theme;
    isDark: boolean;
    assignments: any[];
    isLoading: boolean;
    onOpenAction: (action: string, job?: any) => void;
    techName: string;
    onOpenObliqueStrategy: () => void;
}

export const JobsView = ({ theme, isDark, assignments, isLoading, onOpenAction, techName, onOpenObliqueStrategy }: JobsViewProps) => {
    const [viewMode, setViewMode] = useState<'upcoming' | 'past'>('upcoming');
    const [timeSpan, setTimeSpan] = useState('2weeks');

    const isCrewChief = assignments.some(a => {
        const category = getCategoryFromAssignment(a);
        return category === 'responsable';
    });

    // Calculate date ranges based on timeSpan
    const getDateRange = () => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (viewMode === 'upcoming') {
            startDate = now;
            switch (timeSpan) {
                case '1week':
                    endDate = addWeeks(now, 1);
                    break;
                case '2weeks':
                    endDate = addWeeks(now, 2);
                    break;
                case '1month':
                    endDate = addMonths(now, 1);
                    break;
                case '3months':
                    endDate = addMonths(now, 3);
                    break;
                default:
                    endDate = addWeeks(now, 2);
            }
        } else {
            endDate = now;
            switch (timeSpan) {
                case '1week':
                    startDate = addWeeks(now, -1);
                    break;
                case '2weeks':
                    startDate = addWeeks(now, -2);
                    break;
                case '1month':
                    startDate = addMonths(now, -1);
                    break;
                case '3months':
                    startDate = addMonths(now, -3);
                    break;
                default:
                    startDate = addWeeks(now, -2);
            }
        }
        return { startDate, endDate };
    };

    // Filter assignments based on view mode and time span
    const filteredAssignments = assignments.filter(assignment => {
        const jobData = assignment.jobs || assignment;
        if (!jobData?.start_time) return false;

        const jobStart = new Date(jobData.start_time);
        const { startDate, endDate } = getDateRange();

        if (viewMode === 'upcoming') {
            return jobStart >= startDate && jobStart <= endDate;
        } else {
            return jobStart >= startDate && jobStart < endDate;
        }
    });

    // Time span options based on view mode
    const timeSpanOptions = viewMode === 'upcoming'
        ? [
            { value: '1week', label: 'Próxima semana' },
            { value: '2weeks', label: 'Próximas 2 semanas' },
            { value: '1month', label: 'Próximo mes' },
            { value: '3months', label: 'Próximos 3 meses' },
        ]
        : [
            { value: '1week', label: 'Semana pasada' },
            { value: '2weeks', label: 'Últimas 2 semanas' },
            { value: '1month', label: 'Mes pasado' },
            { value: '3months', label: 'Últimos 3 meses' },
        ];

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h1 className={`text-2xl font-bold ${theme.textMain}`}>Mis trabajos</h1>
                <Badge variant="outline">{filteredAssignments.length} asignaciones</Badge>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Upcoming/Past Toggle */}
                <div className={`flex rounded-xl p-1 ${isDark ? 'bg-[#0a0c10]' : 'bg-slate-100'}`}>
                    <button
                        onClick={() => setViewMode('upcoming')}
                        className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'upcoming'
                            ? `${theme.accent} shadow-md`
                            : theme.textMuted
                            }`}
                    >
                        Próximos
                    </button>
                    <button
                        onClick={() => setViewMode('past')}
                        className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'past'
                            ? `${theme.accent} shadow-md`
                            : theme.textMuted
                            }`}
                    >
                        Pasados
                    </button>
                </div>

                {/* Time Span Selector */}
                <div className={`flex-1 sm:flex-none`}>
                    <select
                        value={timeSpan}
                        onChange={(e) => setTimeSpan(e.target.value)}
                        className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold border ${theme.input} ${theme.card} appearance-none cursor-pointer`}
                    >
                        {timeSpanOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : filteredAssignments.length === 0 ? (
                <div className={`p-12 rounded-xl border ${theme.card} text-center`}>
                    <Briefcase size={48} className={`mx-auto mb-4 ${theme.textMuted}`} />
                    <p className={theme.textMuted}>
                        {viewMode === 'upcoming'
                            ? 'No tienes asignaciones próximas en este periodo'
                            : 'No tienes asignaciones pasadas en este periodo'
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAssignments.map((assignment, index) => (
                        <TechJobCard
                            key={assignment.id || index}
                            job={assignment}
                            theme={theme}
                            isDark={isDark}
                            onAction={onOpenAction}
                            isCrewChief={isCrewChief}
                            techName={techName}
                            onOpenObliqueStrategy={onOpenObliqueStrategy}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
