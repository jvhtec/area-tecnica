import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Speaker, Sliders, Camera, User, Radio, MoreVertical, Calendar as CalendarIcon, FileText, ChevronRight } from 'lucide-react';
import { Theme } from './types';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';

interface TourCardProps {
    tour: {
        id: string;
        name: string;
        description?: string;
        color: string;
        start_date?: string;
        end_date?: string;
        assignment_role: string;
        assignment_department: string;
        assignment_notes?: string;
        total_dates: number;
        upcoming_dates: number;
    };
    theme: Theme;
    isDark: boolean;
    onNavigate: (tourId: string) => void;
}

export const TourCard = ({ tour, theme, isDark, onNavigate }: TourCardProps) => {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    // Fetch tour logo using the shared utility
    useEffect(() => {
        if (tour.id) {
            fetchTourLogo(tour.id).then((url) => setLogoUrl(url || null));
        }
    }, [tour.id]);
    const progress = tour.total_dates > 0
        ? ((tour.total_dates - tour.upcoming_dates) / tour.total_dates) * 100
        : 0;

    const getDepartmentIcon = (department: string) => {
        switch (department?.toLowerCase()) {
            case 'sound': return <Speaker size={14} className="text-blue-400" />;
            case 'lights': return <Sliders size={14} className="text-amber-400" />;
            case 'video': return <Camera size={14} className="text-purple-400" />;
            default: return <User size={14} className="text-gray-400" />;
        }
    };

    const getDepartmentLabel = (department: string) => {
        switch (department?.toLowerCase()) {
            case 'sound': return 'Sonido';
            case 'lights': return 'Luces';
            case 'video': return 'Vídeo';
            default: return department || 'Técnico';
        }
    };

    const formatDateRange = () => {
        if (!tour.start_date && !tour.end_date) return 'Sin fechas';
        const start = tour.start_date ? format(new Date(tour.start_date), "d 'de' MMM", { locale: es }) : '';
        const end = tour.end_date ? format(new Date(tour.end_date), "d 'de' MMM, yyyy", { locale: es }) : '';
        if (start && end) return `${start} - ${end}`;
        return start || end;
    };

    return (
        <div
            onClick={() => onNavigate(tour.id)}
            className={`
        group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer
        ${theme.card} hover:border-blue-500/50
      `}
        >
            {/* Header with gradient using tour color */}
            <div className="h-28 w-full relative overflow-hidden">
                <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                        background: `linear-gradient(135deg, ${tour.color || '#3b82f6'}33, ${isDark ? '#0f1219' : '#ffffff'})`
                    }}
                >
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={`${tour.name} logo`}
                            width={192}
                            height={64}
                            loading="lazy"
                            decoding="async"
                            className="h-16 w-48 object-contain opacity-90"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <Radio size={48} className="opacity-10" />
                    )}
                </div>

                {/* Context Menu */}
                <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm transition-colors"
                >
                    <MoreVertical size={16} />
                </button>

                {/* Tour Name Overlay */}
                <div className="absolute bottom-3 left-4 right-4">
                    <h3 className={`text-lg font-bold truncate ${theme.textMain}`}>{tour.name}</h3>
                    {tour.description && (
                        <p className={`text-xs ${theme.textMuted} truncate`}>{tour.description}</p>
                    )}
                </div>
            </div>

            {/* Stats Row */}
            <div className={`px-4 py-3 flex items-center justify-between border-b border-dashed ${theme.divider}`}>
                <div className="flex items-center gap-2 text-xs font-medium">
                    <CalendarIcon size={14} className="text-blue-500" />
                    <span className={theme.textMain}>{formatDateRange()}</span>
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isDark ? 'bg-gray-500/10 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                    {tour.total_dates} Fechas
                </div>
            </div>

            {/* Body Content */}
            <div className="p-4">
                {/* Role Assignment */}
                <div className="mb-4">
                    <div className={`text-[10px] font-bold uppercase mb-2 ${theme.textMuted}`}>Tu asignación</div>
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isDark ? 'bg-[#151820] border-[#2a2e3b]' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center gap-2">
                            {getDepartmentIcon(tour.assignment_department)}
                            <div className="flex flex-col">
                                <span className={`font-bold text-sm ${theme.textMain}`}>{tour.assignment_role || 'Técnico'}</span>
                                <span className={`text-[10px] ${theme.textMuted}`}>{getDepartmentLabel(tour.assignment_department)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`block font-mono text-xs font-bold ${theme.textMain}`}>{tour.upcoming_dates}</span>
                            <span className="text-[10px] text-blue-500 font-bold">próximas</span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] mb-1">
                        <span className={theme.textMuted}>Progreso</span>
                        <span className={theme.textMain}>{Math.round(progress)}%</span>
                    </div>
                    <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, backgroundColor: tour.color || '#3b82f6' }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {tour.assignment_notes && (
                            <span className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${isDark ? 'bg-[#1a1d26] text-gray-300 border-[#2a2e3b]' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                <FileText size={10} /> Notas
                            </span>
                        )}
                    </div>
                    <ChevronRight size={16} className={`${theme.textMuted} group-hover:translate-x-1 transition-transform`} />
                </div>
            </div>
        </div>
    );
};
