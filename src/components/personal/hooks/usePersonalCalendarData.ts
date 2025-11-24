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

const dateOnly = (date: Date) => date.toISOString().split('T')[0];

export const usePersonalCalendarData = (currentMonth: Date) => {
  const [houseTechs, setHouseTechs] = useState<HouseTech[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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

        let assignmentResults: Assignment[] = [];

        if (techIds.length > 0) {
          // Query timesheets as source of truth, joined with jobs for timeline info
          const { data: timesheetData, error: timesheetsError } = await supabase
            .from('timesheets')
            .select(`
              technician_id,
              job_id,
              date,
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
            .lte('jobs.start_time', endDate.toISOString())
            .gte('jobs.end_time', startDate.toISOString());

          if (timesheetsError) {
            throw timesheetsError;
          }

          // Deduplicate by job_id + technician_id (timesheets have one row per date)
          const seenKeys = new Set<string>();
          const baseAssignments: Assignment[] = (timesheetData ?? [])
            .filter((row) => {
              const key = `${row.job_id}-${row.technician_id}`;
              if (seenKeys.has(key)) return false;
              seenKeys.add(key);
              return true;
            })
            .map((row) => {
              const jobData = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
              if (!jobData) {
                return null;
              }

              const locationValue = Array.isArray(jobData.locations)
                ? jobData.locations[0]
                : jobData.locations;

              return {
                technician_id: row.technician_id,
                sound_role: null,
                lights_role: null,
                video_role: null,
                single_day: false,
                assignment_date: null,
                job: {
                  id: jobData.id,
                  title: jobData.title,
                  color: jobData.color,
                  start_time: jobData.start_time,
                  end_time: jobData.end_time,
                  status: jobData.status,
                  location: locationValue?.name ? { name: locationValue.name } : null,
                },
              };
            })
            .filter(Boolean) as Assignment[];

          assignmentResults = baseAssignments;

          if (baseAssignments.length > 0) {
            const jobIds = Array.from(new Set(baseAssignments.map((assignment) => assignment.job.id)));
            if (jobIds.length > 0) {
              const { data: jobAssignmentData, error: jobAssignmentsError } = await supabase
                .from('job_assignments')
                .select(`
                  technician_id,
                  job_id,
                  sound_role,
                  lights_role,
                  video_role,
                  single_day,
                  assignment_date
                `)
                .in('job_id', jobIds)
                .in('technician_id', techIds);

              if (jobAssignmentsError) {
                throw jobAssignmentsError;
              }

              const assignmentLookup = new Map<string, {
                sound_role: string | null;
                lights_role: string | null;
                video_role: string | null;
                single_day: boolean;
                assignment_date: string | null;
              }>();

              (jobAssignmentData ?? []).forEach((row) => {
                const key = `${row.job_id}-${row.technician_id}`;
                assignmentLookup.set(key, {
                  sound_role: row.sound_role ?? null,
                  lights_role: row.lights_role ?? null,
                  video_role: row.video_role ?? null,
                  single_day: row.single_day ?? false,
                  assignment_date: row.assignment_date ?? null,
                });
              });

              assignmentResults = baseAssignments.map((assignment) => {
                const key = `${assignment.job.id}-${assignment.technician_id}`;
                const assignmentData = assignmentLookup.get(key);
                return {
                  ...assignment,
                  sound_role: assignmentData?.sound_role ?? null,
                  lights_role: assignmentData?.lights_role ?? null,
                  video_role: assignmentData?.video_role ?? null,
                  single_day: assignmentData?.single_day ?? false,
                  assignment_date: assignmentData?.assignment_date ?? null,
                };
              });
            }
          }
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

    const timesheetChannel = supabase
      .channel('personal-calendar-timesheets')
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

    const assignmentChannel = supabase
      .channel('personal-calendar-job-assignments')
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
      supabase.removeChannel(timesheetChannel);
      supabase.removeChannel(assignmentChannel);
      supabase.removeChannel(availabilityChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]); // Only refetch when the month changes, not every day selection

  return { houseTechs, assignments, vacationPeriods, isLoading };
};
