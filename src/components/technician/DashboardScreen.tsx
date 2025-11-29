import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { Map as MapIcon, Calendar as CalendarIcon, MessageSquare, Euro, Loader2, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMyTours } from '@/hooks/useMyTours';
import { getCategoryFromAssignment } from '@/utils/roleCategory';
import { TechJobCard } from './TechJobCard';
import { TourCard } from './TourCard';
import { Theme } from './types';

interface DashboardScreenProps {
    theme: Theme;
    isDark: boolean;
    user: any;
    userProfile: any;
    assignments: any[];
    isLoading: boolean;
    onOpenAction: (action: string, job?: any) => void;
    onOpenSV: () => void;
    onOpenObliqueStrategy: () => void;
    onOpenTour: (tourId: string) => void;
    onOpenRates: () => void;
    onOpenMessages: () => void;
    hasSoundVisionAccess: boolean;
}

export const DashboardScreen = ({ theme, isDark, user, userProfile, assignments, isLoading, onOpenAction, onOpenSV, onOpenObliqueStrategy, onOpenTour, onOpenRates, onOpenMessages, hasSoundVisionAccess }: DashboardScreenProps) => {
    const { activeTours } = useMyTours();

    const userInitials = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name[0]}${userProfile.last_name[0]}`.toUpperCase()
        : user?.email?.[0]?.toUpperCase() || '?';

    const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : user?.email || 'Técnico';

    const isCrewChief = userProfile?.role === 'house_tech' ||
        assignments.some(a => {
            const category = getCategoryFromAssignment(a);
            return category === 'responsable';
        });

    // Get today's assignment
    const todayAssignment = assignments.find(a => {
        const jobData = a.jobs || a;
        if (!jobData?.start_time) return false;
        const jobDate = new Date(jobData.start_time);
        const today = new Date();
        return jobDate.toDateString() === today.toDateString();
    });

    // Calculate weekly hours (simplified)
    const weeklyHours = assignments.length * 8; // Placeholder

    // Get next shift time
    const nextShift = assignments[0]?.jobs?.start_time
        ? formatInTimeZone(new Date(assignments[0].jobs.start_time), 'Europe/Madrid', 'HH:mm')
        : '--:--';

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className={`text-2xl font-bold ${theme.textMain}`}>Panel</h1>
                    <p className={`text-xs ${theme.textMuted}`}>Bienvenido, {userName}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                    {userInitials}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
                <div className={`p-2 rounded-xl border ${theme.card}`}>
                    <div className={`text-[10px] font-bold uppercase ${theme.textMuted} mb-1`}>Próximo turno</div>
                    <div className={`text-lg font-bold ${theme.textMain}`}>{nextShift}</div>
                </div>
                <div className={`p-2 rounded-xl border ${theme.card}`}>
                    <div className={`text-[10px] font-bold uppercase ${theme.textMuted} mb-1`}>Esta semana</div>
                    <div className={`text-lg font-bold ${theme.textMain}`}>{assignments.length} trabajos</div>
                </div>
                <div className={`p-2 rounded-xl border ${theme.card} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-blue-600/10" />
                    <div className="text-[10px] font-bold uppercase text-blue-400 mb-1">Tours</div>
                    <div className="text-lg font-bold text-blue-400">{activeTours.length}</div>
                </div>
            </div>

            {/* Quick Tools */}
            <div>
                <h2 className={`text-xs font-bold uppercase ${theme.textMuted} mb-3`}>Herramientas</h2>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {hasSoundVisionAccess && (
                        <button
                            onClick={onOpenSV}
                            className={`flex-shrink-0 w-28 h-24 p-3 rounded-xl border ${theme.card} flex flex-col justify-between hover:border-blue-500 transition-colors text-left group`}
                        >
                            <MapIcon size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
                            <span className={`text-xs font-bold ${theme.textMain}`}>SoundVision<br />Database</span>
                        </button>
                    )}
                    <button
                        onClick={onOpenMessages}
                        className={`flex-shrink-0 w-28 h-24 p-3 rounded-xl border ${theme.card} flex flex-col justify-between hover:border-purple-500 transition-colors text-left group`}
                    >
                        <MessageSquare size={20} className="text-purple-500 group-hover:scale-110 transition-transform" />
                        <span className={`text-xs font-bold ${theme.textMain}`}>Mensajes</span>
                    </button>
                    <button
                        onClick={onOpenRates}
                        className={`flex-shrink-0 w-28 h-24 p-3 rounded-xl border ${theme.card} flex flex-col justify-between hover:border-emerald-500 transition-colors text-left group`}
                    >
                        <Euro size={20} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                        <span className={`text-xs font-bold ${theme.textMain}`}>Mis<br />tarifas</span>
                    </button>
                </div>
            </div>

            {/* My Tours Section */}
            {activeTours.length > 0 && (
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${theme.textMuted}`}>Mis giras</h2>
                        <Badge variant="outline">{activeTours.length}</Badge>
                    </div>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
                        {activeTours.map((tour) => (
                            <div key={tour.id} className="flex-shrink-0 w-72">
                                <TourCard
                                    tour={tour}
                                    theme={theme}
                                    isDark={isDark}
                                    onNavigate={onOpenTour}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Today's Assignment */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h2 className={`text-sm font-bold uppercase tracking-wider ${theme.textMuted}`}>Asignación de hoy</h2>
                    <span className="text-[10px] text-blue-500 font-bold">{format(new Date(), 'dd MMM', { locale: es })}</span>
                </div>
                {isLoading ? (
                    <div className={`p-8 rounded-xl border ${theme.card} flex items-center justify-center`}>
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                ) : todayAssignment ? (
                    <TechJobCard
                        job={todayAssignment}
                        theme={theme}
                        isDark={isDark}
                        onAction={onOpenAction}
                        isCrewChief={isCrewChief}
                        techName={userName}
                        onOpenObliqueStrategy={onOpenObliqueStrategy}
                    />
                ) : (
                    <div className={`p-8 rounded-xl border ${theme.card} text-center`}>
                        <Briefcase size={32} className={`mx-auto mb-2 ${theme.textMuted}`} />
                        <p className={`text-sm ${theme.textMuted}`}>Sin asignaciones para hoy</p>
                    </div>
                )}
            </div>
        </div>
    );
};
