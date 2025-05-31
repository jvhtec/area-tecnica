
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

export const usePersonalCalendarData = (currentMonth: Date) => {
  const [houseTechs, setHouseTechs] = useState<HouseTech[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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
          .gte('jobs.start_time', startDate.toISOString())
          .lte('jobs.end_time', endDate.toISOString());

        if (assignmentsError) {
          console.error('PersonalCalendar: Error fetching assignments:', assignmentsError);
          setIsLoading(false);
          return;
        }

        console.log('PersonalCalendar: Raw assignments data:', assignmentsData);

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
              end_time: jobData.end_time,
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
    const channel = supabase
      .channel('personal-calendar-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments'
        },
        () => {
          console.log('PersonalCalendar: Real-time update received, refetching data');
          // Refetch data when assignments change
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMonth]);

  return { houseTechs, assignments, isLoading };
};
