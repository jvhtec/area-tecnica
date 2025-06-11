
import React, { useState } from 'react';
import { PersonalCalendar } from '@/components/personal/PersonalCalendar';
import { VacationRequestForm } from '@/components/personal/VacationRequestForm';
import { VacationManagement } from '@/components/personal/VacationManagement';
import { VacationRequestHistory } from '@/components/personal/VacationRequestHistory';
import { useAuth } from '@/hooks/useAuth';
import { useVacationRequests } from '@/hooks/useVacationRequests';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Settings, History } from 'lucide-react';

const Personal = () => {
  const [date, setDate] = useState<Date>(new Date());
  const { user } = useAuth();
  const { submitRequest, isSubmitting } = useVacationRequests();

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
    if (!user) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Please log in to access vacation features.</p>
          </CardContent>
        </Card>
      );
    }

    const isHouseTech = user.role === 'house_tech';
    const isAdminOrManagement = user.role === 'admin' || user.role === 'management';

    if (isHouseTech) {
      return (
        <Tabs defaultValue="request" className="space-y-4">
          <TabsList>
            <TabsTrigger value="request" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Request Vacation
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              My Requests
            </TabsTrigger>
          </TabsList>
          <TabsContent value="request">
            <VacationRequestForm
              onSubmit={handleVacationRequestSubmit}
              isSubmitting={isSubmitting}
            />
          </TabsContent>
          <TabsContent value="history">
            <VacationRequestHistory />
          </TabsContent>
        </Tabs>
      );
    }

    if (isAdminOrManagement) {
      return (
        <Tabs defaultValue="manage" className="space-y-4">
          <TabsList>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Manage Requests
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manage">
            <VacationManagement />
          </TabsContent>
        </Tabs>
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
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">House Technician Calendar</h1>
        <p className="text-muted-foreground">Track house tech assignments and availability</p>
      </div>
      
      <PersonalCalendar 
        date={date}
        onDateSelect={setDate}
      />

      {/* Vacation Management Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Vacation Requests</h2>
        {renderVacationContent()}
      </div>
    </div>
  );
};

export default Personal;
