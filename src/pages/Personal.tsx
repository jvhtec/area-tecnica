import React, { useState } from 'react';
import { PersonalCalendar } from '@/components/personal/PersonalCalendar';
import { MobilePersonalCalendar } from '@/components/personal/MobilePersonalCalendar';
import { VacationRequestsTabs } from '@/components/personal/VacationRequestsTabs';
import { useAuth } from '@/hooks/useAuth';
import { useVacationRequests } from '@/hooks/useVacationRequests';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

const Personal = () => {
  const [date, setDate] = useState<Date>(new Date());
  const { user, userRole } = useAuth();
  const { submitRequest, isSubmitting } = useVacationRequests();
  const isMobile = useIsMobile();

  console.log('Personal page: Rendering with date:', date);

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

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl md:text-3xl font-bold">House Technician Calendar</h1>
        <p className="text-sm md:text-base text-muted-foreground">Track house tech assignments and availability</p>
      </div>
      
      {isMobile ? (
        <div className="-mx-4 sm:mx-0">
          <MobilePersonalCalendar 
            date={date}
            onDateSelect={setDate}
          />
        </div>
      ) : (
        <PersonalCalendar 
          date={date}
          onDateSelect={setDate}
        />
      )}

      {/* Vacation Management Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Vacation Requests</h2>
        {renderVacationContent()}
      </div>
    </div>
  );
};

export default Personal;