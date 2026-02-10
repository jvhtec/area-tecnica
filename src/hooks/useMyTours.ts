
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";

export interface MyTour {
  id: string;
  name: string;
  description?: string;
  color: string;
  start_date?: string;
  end_date?: string;
  assignment_role: string;
  assignment_department: string;
  assignment_notes?: string;
  total_dates: number;
  upcoming_dates: number;
}

export const useMyTours = () => {
  const { user, userDepartment } = useOptimizedAuth();

  const { data: tours = [], isLoading, error, refetch } = useQuery({
    queryKey: ['my-tours', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      // 1) Tours where the technician is explicitly assigned as tour crew
      const { data: crewAssignments, error: crewError } = await supabase
        .from('tour_assignments')
        .select(`
          role,
          department,
          notes,
          tours!inner (
            id,
            name,
            description,
            color,
            status,
            start_date,
            end_date,
            tour_dates (
              id,
              date
            )
          )
        `)
        .eq('technician_id', user.id)
        .eq('tours.status', 'active')
        .order('tours(start_date)', { ascending: true });

      if (crewError) throw crewError;

      // 2) Tours where the technician has at least one active timesheet entry in the tour
      // (timesheets are the canonical source of which days a tech actually works).
      const { data: timeRows, error: timeError } = await supabase
        .from('timesheets')
        .select(`
          job_id,
          date,
          is_active,
          jobs!inner (
            id,
            start_time,
            end_time,
            tour_id,
            tour:tours (
              id,
              name,
              description,
              color,
              status,
              start_date,
              end_date,
              tour_dates (
                id,
                date
              )
            )
          )
        `)
        .eq('technician_id', user.id)
        .eq('is_active', true);

      if (timeError) {
        // If this secondary query fails, we still return the crew tours.
        console.warn('[useMyTours] timesheet-based tour lookup failed:', timeError);
      }

      const now = new Date();

      const byTourId = new Map<string, MyTour>();

      const upsert = (tour: any, meta: Partial<MyTour>) => {
        if (!tour?.id) return;
        const tourDates = tour.tour_dates || [];
        const upcomingDates = tourDates.filter(
          (dateEntry: any) => new Date(dateEntry.date) >= now
        ).length;

        const existing = byTourId.get(tour.id);
        if (existing) {
          // Keep the strongest assignment type (crew beats job-based)
          const isExistingCrew = existing.assignment_role !== 'Por bolo';
          const isNewCrew = meta.assignment_role !== 'Por bolo';
          if (!isExistingCrew && isNewCrew) {
            byTourId.set(tour.id, {
              ...existing,
              ...meta,
              total_dates: existing.total_dates,
              upcoming_dates: existing.upcoming_dates,
            } as MyTour);
          }
          return;
        }

        byTourId.set(tour.id, {
          id: tour.id,
          name: tour.name,
          description: tour.description,
          color: tour.color,
          start_date: tour.start_date,
          end_date: tour.end_date,
          assignment_role: meta.assignment_role || 'Por bolo',
          assignment_department: meta.assignment_department || 'unknown',
          assignment_notes: meta.assignment_notes,
          total_dates: tourDates.length,
          upcoming_dates: upcomingDates,
        });
      };

      // Crew tours
      (crewAssignments || []).forEach((assignment: any) => {
        const tour = assignment.tours as any;
        upsert(tour, {
          assignment_role: assignment.role,
          assignment_department: assignment.department,
          assignment_notes: assignment.notes,
        });
      });

      // Timesheet-based tours (canonical)
      (timeRows || []).forEach((row: any) => {
        const job = row.jobs as any;
        const tour = job?.tour as any;
        if (!tour) return;
        if (tour.status !== 'active') return;

        upsert(tour, {
          assignment_role: 'Por bolo',
          assignment_department: (userDepartment || 'unknown') as any,
        });
      });

      // Return sorted by start_date
      return Array.from(byTourId.values()).sort((a, b) => {
        const aT = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bT = b.start_date ? new Date(b.start_date).getTime() : 0;
        return aT - bT;
      });
    },
    enabled: !!user?.id,
  });

  const activeTours = tours.filter(tour => {
    if (!tour.end_date) return true;
    return new Date(tour.end_date) >= new Date();
  });

  const completedTours = tours.filter(tour => {
    if (!tour.end_date) return false;
    return new Date(tour.end_date) < new Date();
  });

  return {
    tours,
    activeTours,
    completedTours,
    isLoading,
    error,
    refetch
  };
};
