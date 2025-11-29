import React, { useState, useEffect } from 'react';
import { PersonalCalendar } from '@/components/personal/PersonalCalendar';
import { MobilePersonalCalendar } from '@/components/personal/MobilePersonalCalendar';
import { VacationRequestsTabs } from '@/components/personal/VacationRequestsTabs';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useVacationRequests } from '@/hooks/useVacationRequests';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, LayoutDashboard, Briefcase, Calendar as CalendarIcon, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTechnicianTheme } from '@/hooks/useTechnicianTheme';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Personal = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [isVacationSectionOpen, setIsVacationSectionOpen] = useState(false);
  const { user, userRole } = useOptimizedAuth();
  const { submitRequest, isSubmitting } = useVacationRequests();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  console.log('Personal page: Rendering with date:', date);

  // Redirect technicians to tech app - they shouldn't access personal calendar
  useEffect(() => {
    if (userRole === 'technician') {
      console.log('Technician trying to access personal calendar, redirecting to tech app');
      navigate('/tech-app');
    }
  }, [userRole, navigate]);

  const handleVacationRequestSubmit = async (request: { startDate: string; endDate: string; reason: string }) => {
    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }

    submitRequest({
      start_date: request.startDate,
      end_date: request.endDate,
      reason: request.reason,
    });
  };

  // Show appropriate content based on user role
  const renderVacationContent = () => {
    if (!user || !userRole) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Inicia sesión para gestionar solicitudes de vacaciones.</p>
          </CardContent>
        </Card>
      );
    }

    if (userRole === 'house_tech' || userRole === 'management' || userRole === 'admin') {
      return (
        <VacationRequestsTabs
          userRole={userRole}
          onVacationRequestSubmit={handleVacationRequestSubmit}
          isSubmitting={isSubmitting}
          theme={theme}
          isDark={isDark}
        />
      );
    }

    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Las solicitudes de vacaciones solo están disponibles para técnicos de planta, administración y managers.
          </p>
        </CardContent>
      </Card>
    );
  };

  // House techs have read-only access (can't mark dates)
  const canEditDates = userRole === 'admin' || userRole === 'management';

  // Use technician theme
  const { theme, isDark } = useTechnicianTheme();

  return (
    <div className={`min-h-screen flex flex-col ${theme.bg} transition-colors duration-300 font-sans`}>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-28">
        <div className="w-full mx-auto max-w-full space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="space-y-1 lg:col-span-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-500">Técnicos de la casa</p>
              <h1 className={`text-2xl md:text-3xl font-bold leading-tight ${theme.textMain}`}>Agenda de técnicos de la casa</h1>
              <p className={`text-sm md:text-base ${theme.textMuted}`}>
                Controla asignaciones, disponibilidad y solicitudes de vacaciones en móvil.
              </p>
            </div>
            <div className="flex gap-2 lg:col-span-4 lg:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDate(new Date())}
                className={`${theme.card} ${theme.textMain}`}
              >
                Ir a hoy
              </Button>
            </div>
          </div>

          <div className={`${theme.card} rounded-xl p-3 sm:p-4 shadow-sm`}>
            <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDate(new Date())}
                className={`${theme.card} ${theme.textMain}`}
              >
                Ir a hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVacationSectionOpen(true)}
                className={`${theme.card} ${theme.textMain}`}
              >
                Solicitudes de vacaciones
              </Button>
            </div>
          </div>

          {isMobile ? (
            <MobilePersonalCalendar
              date={date}
              onDateSelect={setDate}
              readOnly={!canEditDates}
              theme={theme}
              isDark={isDark}
            />
          ) : (
            <PersonalCalendar
              date={date}
              onDateSelect={setDate}
              readOnly={!canEditDates}
            />
          )}
        </div>
      </div>

      <Dialog open={isVacationSectionOpen} onOpenChange={setIsVacationSectionOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className={theme.textMain}>Solicitudes de vacaciones</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {renderVacationContent()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation - only show on mobile for non-house_tech users */}
      {/* House techs get HouseTechBottomNav from Layout */}
      {isMobile && userRole !== 'house_tech' && (
        <div className={`h-20 ${theme.nav} fixed bottom-0 w-full grid grid-cols-4 px-2 z-40 pb-4`}>
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Panel' },
            { id: 'jobs', icon: Briefcase, label: 'Trabajos' },
            { id: 'availability', icon: CalendarIcon, label: 'Disponib.' },
            { id: 'profile', icon: User, label: 'Perfil' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => navigate('/tech-app')}
              className={`flex flex-col items-center justify-center gap-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}
            >
              <item.icon size={22} strokeWidth={2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Personal;
