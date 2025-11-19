
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

export interface PersonalCalendarAssignment {
  technician_id: string;
  date: string;
  is_schedule_only: boolean;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
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

const dateOnly = (date: Date) => date.toISOString().split('T')[0];

export const usePersonalCalendarData = (currentMonth: Date) => {
  const [houseTechs, setHouseTechs] = useState<HouseTech[]>([]);
  const [assignments, setAssignments] = useState<PersonalCalendarAssignment[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`; // Stable key per month to avoid refetch on day clicks

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);

      try {
        const startDate = subDays(startOfMonth(currentMonth), 7);
        const endDate = addDays(endOfMonth(currentMonth), 7);

        const { data: techsData, error: techsError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, department, phone')
          .eq('role', 'house_tech')
          .order('first_name');

        if (techsError) {
          throw techsError;
        }

        const techIds = (techsData ?? []).map((tech) => tech.id);

        let assignmentResults: PersonalCalendarAssignment[] = [];

        if (techIds.length > 0) {
          const { data: timesheetsData, error: timesheetsError } = await supabase
            .from('timesheets')
            .select(`
              job_id,
              technician_id,
              date,
              is_schedule_only,
              jobs!inner (
                id,
                title,
                color,
                start_time,
                end_time,
                status,
                locations ( name )
              )
            `)
            .in('technician_id', techIds)
            .eq('is_schedule_only', false)
            .gte('date', dateOnly(startDate))
            .lte('date', dateOnly(endDate))
            .order('date');

          if (timesheetsError) {
            throw timesheetsError;
          }

          const timesheetRows = timesheetsData ?? [];

          const uniqueJobIds = Array.from(new Set(timesheetRows.map((row) => row.job_id).filter(Boolean)));
          const uniqueTechIds = Array.from(new Set(timesheetRows.map((row) => row.technician_id).filter(Boolean)));

          let rolesMap = new Map<string, { sound_role: string | null; lights_role: string | null; video_role: string | null }>();

          if (uniqueJobIds.length > 0 && uniqueTechIds.length > 0) {
            const { data: jobAssignmentData, error: jobAssignmentError } = await supabase
              .from('job_assignments')
              .select('job_id, technician_id, sound_role, lights_role, video_role')
              .in('job_id', uniqueJobIds)
              .in('technician_id', uniqueTechIds);

            if (jobAssignmentError) {
              throw jobAssignmentError;
            }

            rolesMap = new Map(
              (jobAssignmentData ?? []).map((assignment) => [
                `${assignment.job_id}:${assignment.technician_id}`,
                {
                  sound_role: assignment.sound_role,
                  lights_role: assignment.lights_role,
                  video_role: assignment.video_role,
                },
              ])
            );
          }

          assignmentResults = timesheetRows
            .map((timesheet) => {
              const jobData = Array.isArray(timesheet.jobs) ? timesheet.jobs[0] : timesheet.jobs;

              if (!jobData) {
                return null;
              }

              const locationValue = Array.isArray(jobData.locations)
                ? jobData.locations[0]
                : jobData.locations;

              const roles = rolesMap.get(`${timesheet.job_id}:${timesheet.technician_id}`) ?? {
                sound_role: null,
                lights_role: null,
                video_role: null,
              };

              return {
                technician_id: timesheet.technician_id,
                date: timesheet.date,
                is_schedule_only: Boolean(timesheet.is_schedule_only),
                sound_role: roles.sound_role,
                lights_role: roles.lights_role,
                video_role: roles.video_role,
                job: {
                  id: jobData.id,
                  title: jobData.title,
                  color: jobData.color,
                  start_time: jobData.start_time,
                  end_time: jobData.end_time,
                  status: jobData.status,
                  location: locationValue?.name ? { name: locationValue.name } : null,
                },
              } as PersonalCalendarAssignment;
            })
            .filter(Boolean) as PersonalCalendarAssignment[];
        }

        let vacationResults: VacationPeriod[] = [];

        if (techIds.length > 0) {
          const { data: vacationData, error: vacationError } = await supabase
            .from('availability_schedules')
            .select('user_id, date, source, notes')
            .in('user_id', techIds)
            .eq('status', 'unavailable')
            .eq('source', 'vacation')
            .gte('date', dateOnly(startDate))
            .lte('date', dateOnly(endDate));

          if (vacationError) {
            throw vacationError;
          }

          vacationResults = (vacationData ?? []).map((entry) => ({
            technician_id: entry.user_id,
            date: entry.date,
            source: entry.source,
            notes: entry.notes ?? undefined,
          }));
        }

        if (!isMounted) {
          return;
        }

        setHouseTechs(techsData ?? []);
        setAssignments(assignmentResults);
        setVacationPeriods(vacationResults);
      } catch (error) {
        console.error('PersonalCalendar: Error fetching data', error);

        if (!isMounted) {
          return;
        }

        setHouseTechs([]);
        setAssignments([]);
        setVacationPeriods([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
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
          table: 'timesheets'
        },
        () => {
          console.log('PersonalCalendar: Real-time update received from timesheets, refetching data');
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
      isMounted = false;
      supabase.removeChannel(assignmentChannel);
      supabase.removeChannel(availabilityChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]); // Only refetch when the month changes, not every day selection

  return { houseTechs, assignments, vacationPeriods, isLoading };
};
