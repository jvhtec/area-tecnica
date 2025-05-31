
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
      
      try {
        // Fetch house technicians
        const { data: techsData, error: techsError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, department, phone')
          .eq('role', 'house_tech')
          .order('first_name');

        if (techsError) {
          console.error('Error fetching house techs:', techsError);
          return;
        }

        setHouseTechs(techsData || []);

        // Calculate date range (current month ± 1 week for better performance)
        const startDate = subDays(startOfMonth(currentMonth), 7);
        const endDate = addDays(endOfMonth(currentMonth), 7);

        // Fetch job assignments for house techs within date range
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
          console.error('Error fetching assignments:', assignmentsError);
          return;
        }

        // Transform the data to match our interface
        const transformedAssignments: Assignment[] = (assignmentsData || []).map(assignment => ({
          technician_id: assignment.technician_id,
          sound_role: assignment.sound_role,
          lights_role: assignment.lights_role,
          video_role: assignment.video_role,
          job: {
            id: assignment.jobs.id,
            title: assignment.jobs.title,
            color: assignment.jobs.color,
            start_time: assignment.jobs.start_time,
            end_time: assignment.jobs.end_time,
            status: assignment.jobs.status,
            location: assignment.jobs.locations ? { name: assignment.jobs.locations.name } : null,
          },
        }));

        setAssignments(transformedAssignments);
      } catch (error) {
        console.error('Error in fetchData:', error);
      } finally {
        setIsLoading(false);
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
