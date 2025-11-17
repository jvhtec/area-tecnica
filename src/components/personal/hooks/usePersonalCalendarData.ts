
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth, subDays, addDays } from 'date-fns';

interface HouseTech {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  phone: string | null;
}

interface Assignment {
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  single_day: boolean;
  assignment_date: string | null;
  job: {
    id: string;
    title: string;
    color: string | null;
    start_time: string;
    end_time: string;
    status: string | null;
    location?: {
      name: string;
    } | null;
  };
}

interface VacationPeriod {
  technician_id: string;
  date: string;
  source: string;
  notes?: string;
}

interface PersonalCalendarResponse {
  houseTechs: HouseTech[];
  assignments: Assignment[];
  vacationPeriods: VacationPeriod[];
}

export const usePersonalCalendarData = (currentMonth: Date) => {
  const [houseTechs, setHouseTechs] = useState<HouseTech[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      try {
        const startDate = subDays(startOfMonth(currentMonth), 7).toISOString();
        const endDate = addDays(endOfMonth(currentMonth), 7).toISOString();

        const { data, error } = await supabase.functions.invoke<PersonalCalendarResponse>('personal-calendar-feed', {
          body: { startDate, endDate },
        });

        if (error) {
          console.error('PersonalCalendar: Error fetching calendar feed', error);
          setHouseTechs([]);
          setAssignments([]);
          setVacationPeriods([]);
          return;
        }

        setHouseTechs(data?.houseTechs ?? []);
        setAssignments(data?.assignments ?? []);
        setVacationPeriods(data?.vacationPeriods ?? []);
      } catch (error) {
        console.error('PersonalCalendar: Error in fetchData:', error);
        setHouseTechs([]);
        setAssignments([]);
        setVacationPeriods([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for assignment changes
    const assignmentChannel = supabase
      .channel('personal-calendar-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments'
        },
        () => {
          console.log('PersonalCalendar: Real-time update received from job_assignments, refetching data');
          fetchData();
        }
      )
      .subscribe();

    // Set up real-time subscription for availability/vacation changes
    const availabilityChannel = supabase
      .channel('personal-calendar-availability')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_schedules'
        },
        () => {
          console.log('PersonalCalendar: Real-time update received from availability_schedules, refetching data');
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assignmentChannel);
      supabase.removeChannel(availabilityChannel);
    };
  }, [currentMonth]);

  return { houseTechs, assignments, vacationPeriods, isLoading };
};
