
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";

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
      console.log("Starting optimistic tour deletion process for tour:", tour.id);

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
        const tourDateIds = tourDates.map(td => td.id);

        // Get all jobs associated with these tour dates
        const { data: jobs, error: jobsQueryError } = await supabase
          .from("jobs")
          .select("id")
          .in("tour_date_id", tourDateIds);

        if (jobsQueryError) {
          console.error("Error fetching jobs:", jobsQueryError);
          throw jobsQueryError;
        }

        console.log("Found jobs:", jobs);

        // Delete all jobs using optimistic deletion
        if (jobs && jobs.length > 0) {
          for (const job of jobs) {
            const result = await deleteJobOptimistically(job.id);
            if (!result.success) {
              console.error("Failed to delete job:", job.id, result.error);
              throw new Error(`Failed to delete job ${job.id}: ${result.error}`);
            }
          }
        }

        // Delete flex folders that reference tour dates (before deleting tour dates)
        console.log("Deleting flex folders linked to tour dates...");
        const { error: flexFoldersError } = await supabase
          .from("flex_folders")
          .delete()
          .in("tour_date_id", tourDateIds);

        if (flexFoldersError) {
          console.error("Error deleting flex folders:", flexFoldersError);
          throw flexFoldersError;
        }

        // Delete tour date overrides
        console.log("Deleting tour date overrides...");
        await Promise.all([
          supabase.from("tour_date_power_overrides").delete().in("tour_date_id", tourDateIds),
          supabase.from("tour_date_weight_overrides").delete().in("tour_date_id", tourDateIds)
        ]);

        // Delete tour dates
        console.log("Deleting tour dates...");
        const { error: tourDatesDeleteError } = await supabase
          .from("tour_dates")
          .delete()
          .eq("tour_id", tour.id);

        if (tourDatesDeleteError) {
          console.error("Error deleting tour dates:", tourDatesDeleteError);
          throw tourDatesDeleteError;
        }
      }

      // Delete tour-related data
      console.log("Deleting tour-related data...");
      await Promise.all([
        supabase.from("tour_logos").delete().eq("tour_id", tour.id),
        supabase.from("tour_power_defaults").delete().eq("tour_id", tour.id),
        supabase.from("tour_weight_defaults").delete().eq("tour_id", tour.id),
        supabase.from("tour_default_sets").delete().eq("tour_id", tour.id),
        supabase.from("tour_assignments").delete().eq("tour_id", tour.id)
      ]);

      // Finally delete the tour
      console.log("Deleting the tour...");
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
      await queryClient.invalidateQueries({ queryKey: ["tours"] });
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
