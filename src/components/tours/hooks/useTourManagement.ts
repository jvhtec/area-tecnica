import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useTourManagement = (tour: any, onClose: () => void) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleColorChange = async (color: string) => {
    try {
      console.log("Updating color for tour:", tour);
      
      // Update the tour's color
      const { error: tourError } = await supabase
        .from("tours")
        .update({ color })
        .eq("id", tour.id);

      if (tourError) {
        console.error("Error updating tour color:", tourError);
        throw tourError;
      }

      // Get all tour dates for this tour
      const { data: tourDates, error: tourDatesError } = await supabase
        .from("tour_dates")
        .select("id")
        .eq("tour_id", tour.id);

      if (tourDatesError) {
        console.error("Error fetching tour dates:", tourDatesError);
        throw tourDatesError;
      }

      console.log("Found tour dates:", tourDates);

      // Update all jobs associated with these tour dates
      if (tourDates && tourDates.length > 0) {
        const { error: jobsError } = await supabase
          .from("jobs")
          .update({ color })
          .in("tour_date_id", tourDates.map(td => td.id));

        if (jobsError) {
          console.error("Error updating jobs colors:", jobsError);
          throw jobsError;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["tours-with-dates"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      
      toast({ title: "Color updated successfully" });
    } catch (error: any) {
      console.error("Error updating color:", error);
      toast({
        title: "Error updating color",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleNameChange = async (name: string) => {
    try {
      console.log("Updating name for tour:", tour.id);
      
      const { error: tourError } = await supabase
        .from("tours")
        .update({ name })
        .eq("id", tour.id);

      if (tourError) {
        console.error("Error updating tour name:", tourError);
        throw tourError;
      }

      await queryClient.invalidateQueries({ queryKey: ["tours-with-dates"] });
      toast({ title: "Tour name updated successfully" });
    } catch (error: any) {
      console.error("Error updating tour name:", error);
      toast({
        title: "Error updating tour name",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      console.log("Starting tour deletion process for tour:", tour.id);

      // Get all tour dates for this tour
      const { data: tourDates, error: tourDatesError } = await supabase
        .from("tour_dates")
        .select("id")
        .eq("tour_id", tour.id);

      if (tourDatesError) {
        console.error("Error fetching tour dates:", tourDatesError);
        throw tourDatesError;
      }

      console.log("Found tour dates:", tourDates);

      if (tourDates && tourDates.length > 0) {
        // First delete flex folders
        const { error: flexFoldersError } = await supabase
          .from("flex_folders")
          .delete()
          .in("tour_date_id", tourDates.map(td => td.id));

        if (flexFoldersError) {
          console.error("Error deleting flex folders:", flexFoldersError);
          throw flexFoldersError;
        }

        // Get all jobs associated with these tour dates
        const { data: jobs, error: jobsError } = await supabase
          .from("jobs")
          .select("id")
          .in("tour_date_id", tourDates.map(td => td.id));

        if (jobsError) {
          console.error("Error fetching jobs:", jobsError);
          throw jobsError;
        }

        console.log("Found jobs:", jobs);

        if (jobs && jobs.length > 0) {
          // Delete job assignments
          const { error: assignmentsError } = await supabase
            .from("job_assignments")
            .delete()
            .in("job_id", jobs.map(j => j.id));

          if (assignmentsError) {
            console.error("Error deleting job assignments:", assignmentsError);
            throw assignmentsError;
          }

          // Delete job departments
          const { error: departmentsError } = await supabase
            .from("job_departments")
            .delete()
            .in("job_id", jobs.map(j => j.id));

          if (departmentsError) {
            console.error("Error deleting job departments:", departmentsError);
            throw departmentsError;
          }

          // Delete jobs
          const { error: jobsDeleteError } = await supabase
            .from("jobs")
            .delete()
            .in("id", jobs.map(j => j.id));

          if (jobsDeleteError) {
            console.error("Error deleting jobs:", jobsDeleteError);
            throw jobsDeleteError;
          }
        }

        // Delete tour dates
        const { error: tourDatesDeleteError } = await supabase
          .from("tour_dates")
          .delete()
          .eq("tour_id", tour.id);

        if (tourDatesDeleteError) {
          console.error("Error deleting tour dates:", tourDatesDeleteError);
          throw tourDatesDeleteError;
        }
      }

      // Finally delete the tour
      const { error: tourDeleteError } = await supabase
        .from("tours")
        .delete()
        .eq("id", tour.id);

      if (tourDeleteError) {
        console.error("Error deleting tour:", tourDeleteError);
        throw tourDeleteError;
      }

      console.log("Tour deletion completed successfully");
      await queryClient.invalidateQueries({ queryKey: ["tours-with-dates"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
      toast({ title: "Tour deleted successfully" });
    } catch (error: any) {
      console.error("Error in deletion process:", error);
      toast({
        title: "Error deleting tour",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return {
    handleColorChange,
    handleNameChange,
    handleDelete,
  };
};