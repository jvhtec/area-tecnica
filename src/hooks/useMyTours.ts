
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();

  const { data: tours = [], isLoading, error, refetch } = useQuery({
    queryKey: ['my-tours', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
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

      if (error) throw error;

      const transformedTours: MyTour[] = data.map(assignment => {
        // Access the tour object correctly - it should be a single object, not an array
        const tour = assignment.tours as any;
        const tourDates = tour.tour_dates || [];
        const now = new Date();
        const upcomingDates = tourDates.filter(
          (dateEntry: any) => new Date(dateEntry.date) >= now
        ).length;

        return {
          id: tour.id,
          name: tour.name,
          description: tour.description,
          color: tour.color,
          start_date: tour.start_date,
          end_date: tour.end_date,
          assignment_role: assignment.role,
          assignment_department: assignment.department,
          assignment_notes: assignment.notes,
          total_dates: tourDates.length,
          upcoming_dates: upcomingDates
        };
      });

      return transformedTours;
    },
    enabled: !!user?.id
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
