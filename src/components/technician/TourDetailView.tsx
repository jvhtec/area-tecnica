import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Calendar as CalendarIcon, FileText, Download, AlertTriangle, Loader2, Users, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Theme } from './types';
import { fetchTourLogo } from '@/utils/pdf/tourLogoUtils';

interface TourDateLocation {
    id: string;
    name: string;
    formatted_address?: string;
}

interface TourDate {
    id: string;
    date: string;
    start_date?: string;
    end_date?: string;
    location_id?: string;
    tour_date_type?: string;
    location?: TourDateLocation | null;
}

interface TourDocument {
    id: string;
    file_name: string;
    file_path: string;
    uploaded_at: string;
    file_type?: string;
}

interface TourDetailViewProps {
    tourId: string;
    theme: Theme;
    isDark: boolean;
    onClose: () => void;
    onOpenJob: (jobId: string) => void;
}

export const TourDetailView = ({ tourId, theme, isDark, onClose, onOpenJob }: TourDetailViewProps) => {
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    // Fetch tour logo
    useEffect(() => {
        if (tourId) {
            fetchTourLogo(tourId).then((url) => setLogoUrl(url || null));
        }
    }, [tourId]);

    // Fetch tour details with correct schema
    const { data: tourData, isLoading: tourLoading } = useQuery({
        queryKey: ['tour-detail-tech', tourId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tours')
                .select(`
          id, name, description, color, status, start_date, end_date,
          tour_dates (
            id,
            date,
            start_date,
            end_date,
            location_id,
            tour_date_type,
            location:locations (id, name, formatted_address)
          ),
          tour_assignments (
            id, role, department, notes,
            profiles:technician_id (id, first_name, last_name)
          )
        `)
                .eq('id', tourId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!tourId,
    });

    // Fetch recent tour documents (correct schema - no document_type column)
    const { data: tourDocs = [] } = useQuery({
        queryKey: ['tour-docs-tech', tourId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tour_documents')
                .select('id, file_name, file_path, uploaded_at, file_type')
                .eq('tour_id', tourId)
                .order('uploaded_at', { ascending: false })
                .limit(5);
            if (error) return [];
            return data || [];
        },
        enabled: !!tourId,
    });

    if (tourLoading) {
        return (
            <div className={`fixed inset-0 z-[60] ${theme.bg} flex items-center justify-center`}>
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!tourData) {
        return (
            <div className={`fixed inset-0 z-[60] ${theme.bg} flex items-center justify-center`}>
                <div className="text-center">
                    <AlertTriangle size={48} className={theme.textMuted} />
                    <p className={`mt-4 ${theme.textMuted}`}>No se pudo cargar la gira</p>
                    <Button onClick={onClose} className="mt-4">Volver</Button>
                </div>
            </div>
        );
    }

    const tourDates: TourDate[] = (tourData.tour_dates as TourDate[]) || [];
    const now = new Date();
    const completedDates = tourDates.filter((d) => new Date(d.date) < now);
    const upcomingDates = tourDates
        .filter((d) => new Date(d.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const nextShow = upcomingDates[0];
    const progress = tourDates.length > 0 ? (completedDates.length / tourDates.length) * 100 : 0;
    const crewCount = tourData.tour_assignments?.length || 0;

    const formatDateRange = () => {
        if (!tourData.start_date && !tourData.end_date) return 'Sin fechas';
        const start = tourData.start_date ? format(new Date(tourData.start_date), "d 'de' MMM", { locale: es }) : '';
        const end = tourData.end_date ? format(new Date(tourData.end_date), "d 'de' MMM, yyyy", { locale: es }) : '';
        if (start && end) return `${start} - ${end}`;
        return start || end;
    };

    const getDateStatus = (dateEntry: TourDate): 'done' | 'next' | 'upcoming' => {
        const dateObj = new Date(dateEntry.date);
        if (dateObj < now) return 'done';
        if (nextShow && dateEntry.id === nextShow.id) return 'next';
        return 'upcoming';
    };

    const handleDownloadDoc = async (doc: TourDocument) => {
        try {
            // Tour documents use the tour-documents bucket, not job-documents
            const { data, error } = await supabase.storage
                .from('tour-documents')
                .createSignedUrl(doc.file_path, 60);
            if (error || !data?.signedUrl) throw error || new Error('Failed to generate URL');
            window.open(data.signedUrl, '_blank');
        } catch {
            toast.error('No se pudo abrir el documento');
        }
    };

    return (
        <div className={`fixed inset-0 z-[60] ${theme.bg} overflow-y-auto`}>
            {/* Hero Header */}
            <div className={`relative pt-6 pb-5 px-5 border-b ${theme.divider} overflow-hidden`}>
                <div
                    className="absolute inset-0 opacity-30"
                    style={{ background: `linear-gradient(to bottom, ${tourData.color || '#3b82f6'}40, transparent)` }}
                />

                <div className="relative z-10">
                    {/* Back Button */}
                    <button
                        onClick={onClose}
                        className={`flex items-center gap-1 text-xs font-bold ${theme.textMuted} mb-4`}
                    >
                        <ArrowLeft size={14} /> Volver
                    </button>

                    {/* Title with optional logo */}
                    <div className="flex items-start gap-4">
                        {logoUrl && (
                            <img
                                src={logoUrl}
                                alt={`${tourData.name} logo`}
                                className="w-16 h-16 object-contain rounded-lg border border-white/20 bg-black/20 backdrop-blur-sm"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                        )}
                        <div className="flex-1">
                            <h1 className={`text-2xl font-bold ${theme.textMain} mb-1`}>{tourData.name}</h1>
                            <div className={`flex items-center gap-3 text-sm ${theme.textMuted}`}>
                                {tourData.description && <span>{tourData.description}</span>}
                                <span className="flex items-center gap-1">
                                    <CalendarIcon size={14} /> {formatDateRange()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className={`p-4 rounded-xl border ${theme.card}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Fechas</span>
                            <CalendarIcon size={14} className="text-blue-500" />
                        </div>
                        <div className={`text-xl font-bold ${theme.textMain}`}>{completedDates.length} / {tourDates.length}</div>
                        <div className={`text-xs ${theme.textMuted}`}>{Math.round(progress)}% completado</div>
                    </div>
                    <div className={`p-4 rounded-xl border ${theme.card}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Equipo</span>
                            <Users size={14} className="text-emerald-500" />
                        </div>
                        <div className={`text-xl font-bold ${theme.textMain}`}>{crewCount}</div>
                        <div className={`text-xs ${theme.textMuted}`}>técnicos asignados</div>
                    </div>
                </div>

                {/* Next Show Highlight */}
                {nextShow && (
                    <div className={`p-5 rounded-xl border relative overflow-hidden ${theme.card}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Globe size={80} />
                        </div>
                        <div className="relative z-10">
                            <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted} mb-1`}>Próximo</div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className={`text-xl font-bold ${theme.textMain}`}>{nextShow.location?.name || 'Recinto'}</h2>
                                    <div className={`text-sm ${theme.textMuted}`}>{nextShow.location?.formatted_address || nextShow.tour_date_type || 'Concierto'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-mono font-bold text-blue-500">
                                        {format(new Date(nextShow.date), "d 'de' MMM", { locale: es })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recent Docs */}
                {tourDocs.length > 0 && (
                    <div className={`p-4 rounded-xl border ${theme.card}`}>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className={`font-bold text-sm ${theme.textMain}`}>Documentos recientes</h3>
                        </div>
                        <div className="space-y-2">
                            {(tourDocs as TourDocument[]).map((doc) => (
                                <button
                                    key={doc.id}
                                    onClick={() => handleDownloadDoc(doc)}
                                    className={`w-full flex items-center gap-3 p-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'} text-left`}
                                >
                                    <FileText size={16} className="text-blue-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-bold truncate ${theme.textMain}`}>{doc.file_name}</div>
                                        <div className={`text-[10px] ${theme.textMuted}`}>
                                            {format(new Date(doc.uploaded_at), "d MMM, HH:mm", { locale: es })}
                                        </div>
                                    </div>
                                    <Download size={14} className={theme.textMuted} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Itinerary */}
                <div>
                    <h3 className={`font-bold ${theme.textMain} mb-3`}>Itinerario</h3>
                    <div className="space-y-2">
                        {tourDates.length === 0 ? (
                            <div className={`p-8 rounded-xl border ${theme.card} text-center`}>
                                <CalendarIcon size={32} className={`mx-auto mb-2 ${theme.textMuted}`} />
                                <p className={`text-sm ${theme.textMuted}`}>No hay fechas programadas</p>
                            </div>
                        ) : (
                            [...tourDates]
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                .map((dateEntry) => {
                                    const status = getDateStatus(dateEntry);
                                    const statusStyles: Record<string, string> = {
                                        done: 'bg-emerald-500/10 text-emerald-500',
                                        next: 'bg-blue-500/10 text-blue-500',
                                        upcoming: isDark ? 'bg-gray-500/10 text-gray-400' : 'bg-slate-100 text-slate-500',
                                    };
                                    const statusLabels: Record<string, string> = { done: 'Hecho', next: 'Próximo', upcoming: 'Pendiente' };

                                    return (
                                        <div
                                            key={dateEntry.id}
                                            className={`flex items-center justify-between p-3 rounded-xl border ${theme.card}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="text-center w-10">
                                                    <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>
                                                        {format(new Date(dateEntry.date), 'MMM', { locale: es })}
                                                    </div>
                                                    <div className={`text-lg font-bold ${theme.textMain}`}>
                                                        {format(new Date(dateEntry.date), 'd')}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className={`font-bold text-sm ${theme.textMain}`}>{dateEntry.location?.name || 'Recinto'}</div>
                                                    <div className={`text-xs ${theme.textMuted}`}>
                                                        {dateEntry.location?.formatted_address || dateEntry.tour_date_type || 'Concierto'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${statusStyles[status]}`}>
                                                    {statusLabels[status]}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
