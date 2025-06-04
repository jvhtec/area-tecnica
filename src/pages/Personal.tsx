
import React, { useState } from 'react';
import { PersonalCalendar } from '@/components/personal/PersonalCalendar';
import { VacationRequestForm } from '@/components/personal/VacationRequestForm';
import { supabase } from '@/lib/supabase';
import { submitVacationRequest } from '../../supabase-server/src/api/vacation-requests';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const Personal = () => {
  const [date, setDate] = useState<Date>(new Date());
  const { user } = useAuth();
  const { toast } = useToast();

  console.log('Personal page: Rendering with date:', date);

  const handleVacationRequestSubmit = async (request: { startDate: string; endDate: string; reason: string }) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated. Cannot submit vacation request.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await submitVacationRequest(supabase, {
      technician_id: user.id,
      start_date: request.startDate,
      end_date: request.endDate,
      reason: request.reason,
    });

    if (error) {
      toast({
        title: "Error submitting request",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request submitted!",
        description: "Your vacation request has been submitted for approval.",
      });
    }
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

      {/* Vacation Request Form */}
      <VacationRequestForm
        onSubmit={handleVacationRequestSubmit}
      />
    </div>
  );
};

export default Personal;
