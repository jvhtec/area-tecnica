import React, { useState, useEffect } from 'react';
import { PersonalCalendar } from '@/components/personal/PersonalCalendar';
import { MobilePersonalCalendar } from '@/components/personal/MobilePersonalCalendar';
import { VacationRequestsTabs } from '@/components/personal/VacationRequestsTabs';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useVacationRequests } from '@/hooks/useVacationRequests';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Personal = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [isVacationSectionOpen, setIsVacationSectionOpen] = useState(false);
  const { user, userRole } = useOptimizedAuth();
  const { submitRequest, isSubmitting } = useVacationRequests();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  console.log('Personal page: Rendering with date:', date);

  // Redirect technicians to technician dashboard - they shouldn't access personal calendar
  useEffect(() => {
    if (userRole === 'technician') {
      console.log('Technician trying to access personal calendar, redirecting to technician dashboard');
      navigate('/technician-dashboard');
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
            <p className="text-muted-foreground">Please log in to access vacation requests.</p>
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
        />
      );
    }

    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            Vacation request features are available for house technicians, admins, and management only.
          </p>
        </CardContent>
      </Card>
    );
  };

  // House techs have read-only access (can't mark dates)
  const canEditDates = userRole === 'admin' || userRole === 'management';

  return (
    <div className="w-full mx-auto max-w-5xl px-safe pt-safe-3 pb-safe-4 sm:px-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">House Techs</p>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">House Technician Calendar</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Track assignments, availability, and vacation requests on mobile.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
            Jump to Today
          </Button>
        </div>
      </div>

      {isMobile ? (
        <MobilePersonalCalendar
          date={date}
          onDateSelect={setDate}
          readOnly={!canEditDates}
        />
      ) : (
        <PersonalCalendar 
          date={date}
          onDateSelect={setDate}
          readOnly={!canEditDates}
        />
      )}

      {/* Vacation Management Section */}
      <Collapsible 
        open={isVacationSectionOpen}
        onOpenChange={setIsVacationSectionOpen}
        className="space-y-4"
      >
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 text-2xl font-semibold p-0 h-auto hover:bg-transparent"
          >
            {isVacationSectionOpen ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
            Vacation Requests
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          {renderVacationContent()}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default Personal;