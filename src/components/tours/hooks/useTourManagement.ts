
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
        const tourDateIds = tourDates.map(td => td.id);

        // 1. First delete flex_folders that reference tour_dates (this was causing the foreign key error)
        console.log("Deleting flex_folders for tour dates...");
        const { error: flexFoldersError } = await supabase
          .from("flex_folders")
          .delete()
          .in("tour_date_id", tourDateIds);

        if (flexFoldersError) {
          console.error("Error deleting flex_folders:", flexFoldersError);
          throw flexFoldersError;
        }

        // 2. Get all jobs associated with these tour dates
        const { data: jobs, error: jobsQueryError } = await supabase
          .from("jobs")
          .select("id")
          .in("tour_date_id", tourDateIds);

        if (jobsQueryError) {
          console.error("Error fetching jobs:", jobsQueryError);
          throw jobsQueryError;
        }

        console.log("Found jobs:", jobs);

        if (jobs && jobs.length > 0) {
          const jobIds = jobs.map(j => j.id);
          
          // 3. Delete power requirement tables
          console.log("Deleting power requirement tables...");
          const { error: powerTablesError } = await supabase
            .from("power_requirement_tables")
            .delete()
            .in("job_id", jobIds);

          if (powerTablesError) {
            console.error("Error deleting power requirement tables:", powerTablesError);
            throw powerTablesError;
          }

          // 4. Delete flex folders for jobs
          console.log("Deleting flex folders for jobs...");
          const { error: jobFlexFoldersError } = await supabase
            .from("flex_folders")
            .delete()
            .in("job_id", jobIds);

          if (jobFlexFoldersError) {
            console.error("Error deleting job flex folders:", jobFlexFoldersError);
            throw jobFlexFoldersError;
          }

          // 5. Delete job assignments
          const { error: assignmentsError } = await supabase
            .from("job_assignments")
            .delete()
            .in("job_id", jobIds);

          if (assignmentsError) {
            console.error("Error deleting job assignments:", assignmentsError);
            throw assignmentsError;
          }

          // 6. Delete task documents for all departments
          try {
            // Get all task IDs for each department
            const { data: soundTasks } = await supabase
              .from("sound_job_tasks")
              .select("id")
              .in("job_id", jobIds);
              
            const { data: lightsTasks } = await supabase
              .from("lights_job_tasks")
              .select("id")
              .in("job_id", jobIds);
              
            const { data: videoTasks } = await supabase
              .from("video_job_tasks")
              .select("id") 
              .in("job_id", jobIds);
              
            // Collect all task IDs
            const soundTaskIds = soundTasks ? soundTasks.map(task => task.id) : [];
            const lightsTaskIds = lightsTasks ? lightsTasks.map(task => task.id) : [];
            const videoTaskIds = videoTasks ? videoTasks.map(task => task.id) : [];
            
            // Delete task documents for each department
            if (soundTaskIds.length > 0) {
              await supabase.from("task_documents").delete().in("sound_task_id", soundTaskIds);
            }
            
            if (lightsTaskIds.length > 0) {
              await supabase.from("task_documents").delete().in("lights_task_id", lightsTaskIds);
            }
            
            if (videoTaskIds.length > 0) {
              await supabase.from("task_documents").delete().in("video_task_id", videoTaskIds);
            }
          } catch (error) {
            console.error("Error deleting task documents:", error);
            throw error;
          }

          // 7. Delete department tasks
          await Promise.all([
            supabase.from("sound_job_tasks").delete().in("job_id", jobIds),
            supabase.from("lights_job_tasks").delete().in("job_id", jobIds),
            supabase.from("video_job_tasks").delete().in("job_id", jobIds)
          ]);

          // 8. Delete department personnel
          await Promise.all([
            supabase.from("sound_job_personnel").delete().in("job_id", jobIds),
            supabase.from("lights_job_personnel").delete().in("job_id", jobIds),
            supabase.from("video_job_personnel").delete().in("job_id", jobIds)
          ]);

          // 9. Delete job documents
          const { error: jobDocsError } = await supabase
            .from("job_documents")
            .delete()
            .in("job_id", jobIds);

          if (jobDocsError) {
            console.error("Error deleting job documents:", jobDocsError);
            throw jobDocsError;
          }

          // 10. Delete logistics events
          const { error: logisticsError } = await supabase
            .from("logistics_events")
            .delete()
            .in("job_id", jobIds);
            
          if (logisticsError) {
            console.error("Error deleting logistics events:", logisticsError);
            throw logisticsError;
          }

          // 11. Delete hoja de ruta
          const { error: hojaError } = await supabase
            .from("hoja_de_ruta")
            .delete()
            .in("job_id", jobIds);
            
          if (hojaError) {
            console.error("Error deleting hoja de ruta:", hojaError);
            throw hojaError;
          }

          // 12. Delete memoria tecnica documents
          await Promise.all([
            supabase.from("memoria_tecnica_documents").delete().in("job_id", jobIds),
            supabase.from("lights_memoria_tecnica_documents").delete().in("job_id", jobIds),
            supabase.from("video_memoria_tecnica_documents").delete().in("job_id", jobIds)
          ]);

          // 13. Delete job departments
          const { error: departmentsError } = await supabase
            .from("job_departments")
            .delete()
            .in("job_id", jobIds);

          if (departmentsError) {
            console.error("Error deleting job departments:", departmentsError);
            throw departmentsError;
          }

          // 14. Delete job date types
          const { error: dateTypesError } = await supabase
            .from("job_date_types")
            .delete()
            .in("job_id", jobIds);
            
          if (dateTypesError) {
            console.error("Error deleting job date types:", dateTypesError);
            throw dateTypesError;
          }

          // 15. Delete job milestones
          const { error: milestonesError } = await supabase
            .from("job_milestones")
            .delete()
            .in("job_id", jobIds);
            
          if (milestonesError) {
            console.error("Error deleting job milestones:", milestonesError);
            throw milestonesError;
          }

          // 16. Delete jobs
          const { error: jobsDeleteError } = await supabase
            .from("jobs")
            .delete()
            .in("id", jobIds);

          if (jobsDeleteError) {
            console.error("Error deleting jobs:", jobsDeleteError);
            throw jobsDeleteError;
          }
        }

        // 17. Delete tour date overrides
        console.log("Deleting tour date overrides...");
        await Promise.all([
          supabase.from("tour_date_power_overrides").delete().in("tour_date_id", tourDateIds),
          supabase.from("tour_date_weight_overrides").delete().in("tour_date_id", tourDateIds)
        ]);

        // 18. Delete tour dates (this was failing before due to flex_folders constraint)
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

      // 19. Delete tour-related data
      console.log("Deleting tour-related data...");
      await Promise.all([
        supabase.from("tour_logos").delete().eq("tour_id", tour.id),
        supabase.from("tour_power_defaults").delete().eq("tour_id", tour.id),
        supabase.from("tour_weight_defaults").delete().eq("tour_id", tour.id),
        supabase.from("tour_default_sets").delete().eq("tour_id", tour.id)
      ]);

      // 20. Finally delete the tour
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
