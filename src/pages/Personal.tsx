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
    <div className="w-full mx-auto px-2 sm:px-4 py-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl md:text-3xl font-bold">House Technician Calendar</h1>
        <p className="text-sm md:text-base text-muted-foreground">Track house tech assignments and availability</p>
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
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2">
                {isVacationSectionOpen ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <h2 className="text-xl md:text-2xl font-semibold">Vacation Requests</h2>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {renderVacationContent()}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};

export default Personal;