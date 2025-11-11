
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

export const usePersonalCalendarData = (currentMonth: Date) => {
  const [houseTechs, setHouseTechs] = useState<HouseTech[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      console.log('PersonalCalendar: Starting data fetch for month:', currentMonth);
      
      try {
        // Fetch house technicians
        console.log('PersonalCalendar: Fetching house technicians...');
        const { data: techsData, error: techsError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, department, phone')
          .eq('role', 'house_tech')
          .order('first_name');

        if (techsError) {
          console.error('PersonalCalendar: Error fetching house techs:', techsError);
          setIsLoading(false);
          return;
        }

        console.log('PersonalCalendar: House techs fetched:', techsData?.length || 0);
        setHouseTechs(techsData || []);

        // Calculate date range (current month ± 1 week for better performance)
        const startDate = subDays(startOfMonth(currentMonth), 7);
        const endDate = addDays(endOfMonth(currentMonth), 7);

        console.log('PersonalCalendar: Date range:', startDate, 'to', endDate);

        // Fetch job assignments for house techs within date range
        console.log('PersonalCalendar: Fetching job assignments...');
        const startIso = startDate.toISOString();
        const endIso = endDate.toISOString();

        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('job_assignments')
          .select(`
            technician_id,
            sound_role,
            lights_role,
            video_role,
            jobs!inner (
              id,
              title,
              color,
              start_time,
              end_time,
              status,
              locations (
                name
              )
            )
          `)
          .in('technician_id', (techsData || []).map(tech => tech.id))
          .lte('jobs.start_time', endIso)
          .or(`jobs.end_time.is.null,jobs.end_time.gte.${startIso}`);

        if (assignmentsError) {
          console.error('PersonalCalendar: Error fetching assignments:', assignmentsError);
          setIsLoading(false);
          return;
        }

        console.log('PersonalCalendar: Raw assignments data:', assignmentsData);

        // Fetch vacation periods (approved vacations showing as unavailable)
        console.log('PersonalCalendar: Fetching vacation periods...');
        const { data: vacationData, error: vacationError } = await supabase
          .from('availability_schedules')
          .select('user_id, date, source, notes')
          .in('user_id', (techsData || []).map(tech => tech.id))
          .eq('status', 'unavailable')
          .eq('source', 'vacation')
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (vacationError) {
          console.error('PersonalCalendar: Error fetching vacation periods:', vacationError);
        } else {
          console.log('PersonalCalendar: Vacation periods fetched:', vacationData?.length || 0);
          setVacationPeriods(vacationData?.map(v => ({
            technician_id: v.user_id,
            date: v.date,
            source: v.source,
            notes: v.notes
          })) || []);
        }

        // Transform the data to match our interface
        const transformedAssignments: Assignment[] = (assignmentsData || []).map(assignment => {
          // Handle the case where jobs might be an array or object
          const jobData = Array.isArray(assignment.jobs) ? assignment.jobs[0] : assignment.jobs;
          
          if (!jobData) {
            console.warn('PersonalCalendar: No job data found for assignment:', assignment);
            return null;
          }

          const transformedAssignment = {
            technician_id: assignment.technician_id,
            sound_role: assignment.sound_role,
            lights_role: assignment.lights_role,
            video_role: assignment.video_role,
            job: {
              id: jobData.id,
              title: jobData.title,
              color: jobData.color,
              start_time: jobData.start_time,
              end_time: jobData.end_time ?? jobData.start_time,
              status: jobData.status,
              location: jobData.locations && Array.isArray(jobData.locations) && jobData.locations.length > 0 
                ? { name: jobData.locations[0].name } 
                : null,
            },
          };

          console.log('PersonalCalendar: Transformed assignment:', transformedAssignment);
          return transformedAssignment;
        }).filter(Boolean) as Assignment[]; // Filter out null values

        console.log('PersonalCalendar: Final transformed assignments:', transformedAssignments.length);
        setAssignments(transformedAssignments);
      } catch (error) {
        console.error('PersonalCalendar: Error in fetchData:', error);
      } finally {
        setIsLoading(false);
        console.log('PersonalCalendar: Data fetch completed');
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
