import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { InvoicingCompany } from "@/types/job";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { queryKeys } from "@/lib/react-query";
import { useMutationFeedback } from "@/hooks/useMutationFeedback";

const TOUR_WITH_DATES_KEY = queryKeys.scope("tours-with-dates");
const TOUR_LIST_KEY = queryKeys.scope("tours");
const OPTIMIZED_JOBS_KEY = queryKeys.scope("optimized-jobs");
const JOBS_KEY = queryKeys.scope("jobs");

export const useTourManagement = (tour: any, onClose: () => void) => {
  const queryClient = useQueryClient();
  const runMutation = useMutationFeedback();

  const handleColorChange = async (color: string) => {
    await runMutation({
      action: async () => {
        console.log("Updating color for tour:", tour);

        const { error: tourError } = await supabase
          .from("tours")
          .update({ color })
          .eq("id", tour.id);

        if (tourError) throw tourError;

        const { data: tourDates, error: tourDatesError } = await supabase
          .from("tour_dates")
          .select("id")
          .eq("tour_id", tour.id);

        if (tourDatesError) throw tourDatesError;

        if (tourDates && tourDates.length > 0) {
          const { error: jobsError } = await supabase
            .from("jobs")
            .update({ color })
            .in("tour_date_id", tourDates.map(td => td.id));

          if (jobsError) throw jobsError;
        }
      },
      success: { title: "Color updated successfully" },
      error: {
        title: "Error updating color",
        fallbackDescription: "The tour color could not be updated.",
      },
      queryClient,
      invalidate: [TOUR_WITH_DATES_KEY, OPTIMIZED_JOBS_KEY, JOBS_KEY],
    });
  };

  const handleNameChange = async (name: string) => {
    await runMutation({
      action: async () => {
        console.log("Updating name for tour:", tour.id);

        const { error: tourError } = await supabase
          .from("tours")
          .update({ name })
          .eq("id", tour.id);

        if (tourError) throw tourError;
      },
      success: { title: "Tour name updated successfully" },
      error: {
        title: "Error updating tour name",
        fallbackDescription: "The tour name could not be updated.",
      },
      queryClient,
      invalidate: [TOUR_WITH_DATES_KEY],
    });
  };

  const handleDescriptionChange = async (description: string) => {
    await runMutation({
      action: async () => {
        console.log("Updating description for tour:", tour.id);

        const { error: tourError } = await supabase
          .from("tours")
          .update({ description })
          .eq("id", tour.id);

        if (tourError) throw tourError;
      },
      success: { title: "Tour description updated successfully" },
      error: {
        title: "Error updating tour description",
        fallbackDescription: "The tour description could not be updated.",
      },
      queryClient,
      invalidate: [TOUR_WITH_DATES_KEY, queryKeys.scope("tour", tour.id)],
    });
  };

  const handleInvoicingCompanyChange = async (invoicingCompany: InvoicingCompany | null) => {
    await runMutation({
      action: async () => {
        console.log("Updating invoicing company for tour:", tour.id);

        const { error: tourError } = await supabase
          .from("tours")
          .update({ invoicing_company: invoicingCompany })
          .eq("id", tour.id);

        if (tourError) throw tourError;

        const { data: tourDates, error: tourDatesError } = await supabase
          .from("tour_dates")
          .select("id")
          .eq("tour_id", tour.id);

        if (tourDatesError) throw tourDatesError;

        if (tourDates && tourDates.length > 0) {
          const { error: jobsError } = await supabase
            .from("jobs")
            .update({ invoicing_company: invoicingCompany })
            .in("tour_date_id", tourDates.map(td => td.id));

          if (jobsError) throw jobsError;
        }
      },
      success: { title: "Invoicing company updated successfully" },
      error: {
        title: "Error updating invoicing company",
        fallbackDescription: "The invoicing company could not be updated.",
      },
      queryClient,
      invalidate: [TOUR_WITH_DATES_KEY, queryKeys.scope("tour", tour.id), OPTIMIZED_JOBS_KEY, JOBS_KEY],
    });
  };

  const handleDelete = async () => {
    await runMutation({
      action: async () => {
        console.log("Starting optimistic tour deletion process for tour:", tour.id);

        const { data: tourDates, error: tourDatesError } = await supabase
          .from("tour_dates")
          .select("id")
          .eq("tour_id", tour.id);

        if (tourDatesError) throw tourDatesError;

        console.log("Found tour dates:", tourDates);

        if (tourDates && tourDates.length > 0) {
          const tourDateIds = tourDates.map(td => td.id);

          const { data: jobs, error: jobsQueryError } = await supabase
            .from("jobs")
            .select("id")
            .in("tour_date_id", tourDateIds);

          if (jobsQueryError) throw jobsQueryError;

          console.log("Found jobs:", jobs);

          if (jobs && jobs.length > 0) {
            for (const job of jobs) {
              const result = await deleteJobOptimistically(job.id);
              if (!result.success) {
                throw new Error(`Failed to delete job ${job.id}: ${result.error}`);
              }
            }
          }

          console.log("Deleting flex folders linked to tour dates...");
          const { error: flexFoldersError } = await supabase
            .from("flex_folders")
            .delete()
            .in("tour_date_id", tourDateIds);

          if (flexFoldersError) throw flexFoldersError;

          console.log("Deleting tour date overrides...");
          await Promise.all([
            supabase.from("tour_date_power_overrides").delete().in("tour_date_id", tourDateIds),
            supabase.from("tour_date_weight_overrides").delete().in("tour_date_id", tourDateIds)
          ]);

          console.log("Deleting tour dates...");
          const { error: tourDatesDeleteError } = await supabase
            .from("tour_dates")
            .delete()
            .eq("tour_id", tour.id);

          if (tourDatesDeleteError) throw tourDatesDeleteError;
        }

        console.log("Deleting tour-related data...");
        await Promise.all([
          supabase.from("tour_logos").delete().eq("tour_id", tour.id),
          supabase.from("tour_power_defaults").delete().eq("tour_id", tour.id),
          supabase.from("tour_weight_defaults").delete().eq("tour_id", tour.id),
          supabase.from("tour_default_sets").delete().eq("tour_id", tour.id),
          supabase.from("tour_assignments").delete().eq("tour_id", tour.id)
        ]);

        console.log("Deleting the tour...");
        const { error: tourDeleteError } = await supabase
          .from("tours")
          .delete()
          .eq("id", tour.id);

        if (tourDeleteError) throw tourDeleteError;
      },
      success: { title: "Tour deleted successfully" },
      error: {
        title: "Error deleting tour",
        fallbackDescription: "The tour could not be deleted.",
      },
      queryClient,
      invalidate: [TOUR_WITH_DATES_KEY, TOUR_LIST_KEY, OPTIMIZED_JOBS_KEY, JOBS_KEY],
      onSuccess: onClose,
    });
  };

  return {
    handleColorChange,
    handleNameChange,
    handleDescriptionChange,
    handleInvoicingCompanyChange,
    handleDelete,
  };
};
