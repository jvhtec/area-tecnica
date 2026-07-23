/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Dispatch, SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { isSingleDayDateType, type DateType } from "@/constants/dateTypes";
import { useToast } from "@/hooks/use-toast";
import { useLocationManagement, type LocationDetails } from "@/hooks/useLocationManagement";
import { dataLayerClient } from "@/services/dataLayerClient";
import { deleteJobDateTypes } from "@/services/deleteJobDateTypes";
import { buildInclusiveDateRange, syncJobRehearsalDates, syncJobRehearsalDatesForJobs } from "@/services/jobRehearsalDates";
import { TECHNICAL_DEPARTMENTS } from "@/types/department";
import { syncFlexElementsForTourDateChange } from "@/utils/flex-folders/syncDateChange";
import { cleanupTourDefaultDocumentsForDate } from "@/utils/tourDefaultDocumentSync";
import { queryKeys } from "@/lib/react-query";
import { buildTourDateJobTitle, emptyDefaultSetSelection, emptyPackageSelection, type DefaultSetSelectionState, type PackageSelectionState } from "@/components/tours/tourDateManagementModel";

type TourDateTableType = Exclude<DateType, "prep_day">;
type DynamicSupabaseClient = { from: (table: string) => any };
const dynamicSupabase = dataLayerClient as unknown as DynamicSupabaseClient;
const fromDynamicTable = (table: string) => dynamicSupabase.from(table);
const toTourDateTableType = (type: DateType): TourDateTableType => type === "prep_day" ? "show" : type;

type Options = {
  tourId: string | null;
  newLocationDetails: LocationDetails | null;
  editLocationDetails: LocationDetails | null;
  buildPackageUpdatePayload: (packageSizes: PackageSelectionState, defaultSetIds: DefaultSetSelectionState) => Record<string, unknown>;
  syncTourDefaultDocumentsForDate: (dateId: string) => Promise<void>;
  invalidateTourDocumentQueries: () => Promise<void>;
  editingTourDate: any;
  foldersExistenceMap?: Record<string, boolean>;
  isDeletingDate: string | null;
  setIsDeletingDate: Dispatch<SetStateAction<string | null>>;
};

export const useTourDateMutations = ({ tourId, newLocationDetails, editLocationDetails, buildPackageUpdatePayload, syncTourDefaultDocumentsForDate, invalidateTourDocumentQueries, editingTourDate, foldersExistenceMap, isDeletingDate, setIsDeletingDate }: Options) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOrCreateLocation, getOrCreateLocationWithDetails } = useLocationManagement();
  const handleAddDate = async (
    location: string,
    tourDateType: DateType = "show",
    startDate: string,
    endDate: string,
    isTourPackOnly: boolean = false,
    packageSizes: PackageSelectionState = emptyPackageSelection(),
    defaultSetIds: DefaultSetSelectionState = emptyDefaultSetSelection()
  ) => {
    try {
      if (!tourId) {
        throw new Error("Tour ID is required");
      }
      const finalEndDate = isSingleDayDateType(tourDateType) ? startDate : (endDate || startDate);
      const dbTourDateType = toTourDateTableType(tourDateType);
      const rehearsalDays = Math.ceil((new Date(finalEndDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

      console.log("Adding new tour date:", { startDate, finalEndDate, location, tourId, tourDateType, isTourPackOnly });

      let locationId: string | null = null;
      if (newLocationDetails && newLocationDetails.name) {
        locationId = await getOrCreateLocationWithDetails(newLocationDetails);
      } else {
        locationId = await getOrCreateLocation(location);
      }
      console.log("Location ID:", locationId);
      const { data: newTourDate, error: tourDateError } = await dataLayerClient.from("tour_dates")
        .insert({
          tour_id: tourId,
          date: startDate, // Keep for backward compatibility
          start_date: startDate,
          end_date: finalEndDate,
          tour_date_type: dbTourDateType,
          rehearsal_days: rehearsalDays,
          location_id: locationId,
          is_tour_pack_only: isTourPackOnly,
          ...buildPackageUpdatePayload(packageSizes, defaultSetIds),
        })
        .select(`
          id,
          date,
          start_date,
          end_date,
          tour_date_type,
          rehearsal_days,
          is_tour_pack_only,
          sound_package_size,
          lights_package_size,
          video_package_size,
          sound_default_set_id,
          lights_default_set_id,
          video_default_set_id,
          location:locations (
            id,
            name
          )
        `)
        .single();
      if (tourDateError) {
        console.error("Error creating tour date:", tourDateError);
        throw tourDateError;
      }
      console.log("Tour date created:", newTourDate);

      // ... keep existing code (job creation and department assignment)
      const { data: tourData, error: tourError } = await dataLayerClient.from("tours")
        .select(`
          name,
          color,
          tour_dates (
            jobs (
              job_departments (
                department
              )
            )
          )
        `)
        .eq("id", tourId)
        .single();
      if (tourError) {
        console.error("Error fetching tour:", tourError);
        throw tourError;
      }

      const { data: newJob, error: jobError } = await dataLayerClient.from("jobs")
        .insert({
          title: buildTourDateJobTitle(tourData.name, location, tourDateType),
          start_time: `${startDate}T06:00:00`,
          end_time: `${finalEndDate}T21:59:59`,
          location_id: locationId,
          tour_date_id: newTourDate.id,
          tour_id: tourId,
          color: tourData.color || "#7E69AB",
          job_type: 'tourdate',
        })
        .select()
        .single();
      if (jobError) {
        console.error("Error creating job:", jobError);
        throw jobError;
      }
      console.log("Job created:", newJob);

      const departments =
        tourData.tour_dates?.[0]?.jobs?.[0]?.job_departments?.map(
          (dept: any) => dept.department
        ) || TECHNICAL_DEPARTMENTS;
      const jobDepartments = departments.map((department) => ({
        job_id: newJob.id,
        department,
      }));
      const { error: deptError } = await dataLayerClient.from("job_departments")
        .insert(jobDepartments);
      if (deptError) {
        console.error("Error creating job departments:", deptError);
        throw deptError;
      }

      const scheduledDates = buildInclusiveDateRange(startDate, finalEndDate);
      const jobDateTypes = scheduledDates.map((date) => ({
        job_id: newJob.id,
        date,
        type: tourDateType,
      }));

      const { error: dateTypeError } = await dataLayerClient.from("job_date_types")
        .insert(jobDateTypes);
      if (dateTypeError) {
        console.error("Error creating job date types:", dateTypeError);
        throw dateTypeError;
      }

      if (tourDateType === "rehearsal") {
        await syncJobRehearsalDates(newJob.id, scheduledDates, { seedMissing: true });
      }

      // Force refresh all related queries after successful creation
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour", tourId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("job-assignments") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("flex-folders-existence") }),
      ]);

      await syncTourDefaultDocumentsForDate(newTourDate.id);

      toast({
        title: "Fecha creada",
        description: "La fecha de gira y el trabajo se crearon correctamente.",
      });
    } catch (error: any) {
      console.error("Error adding date:", error);
      toast({
        title: "Error al añadir la fecha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditDate = async (
    dateId: string,
    newLocation: string,
    tourDateType: DateType,
    startDate: string,
    endDate: string,
    isTourPackOnly: boolean,
    packageSizes: PackageSelectionState,
    defaultSetIds: DefaultSetSelectionState
  ) => {
    try {
      if (!tourId) {
        throw new Error("Tour ID is required");
      }
      const finalEndDate = isSingleDayDateType(tourDateType) ? startDate : (endDate || startDate);
      const dbTourDateType = toTourDateTableType(tourDateType);
      const rehearsalDays = Math.ceil((new Date(finalEndDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log("Editing tour date:", { dateId, startDate, finalEndDate, newLocation, tourDateType, isTourPackOnly });
      let locationId: string | null = null;
      if (editLocationDetails && editLocationDetails.name) {
        locationId = await getOrCreateLocationWithDetails(editLocationDetails);
      } else {
        locationId = await getOrCreateLocation(newLocation);
      }

      const { data: tourData, error: tourError } = await dataLayerClient.from("tours")
        .select("name")
        .eq("id", tourId)
        .single();

      if (tourError) {
        console.error("Error fetching tour:", tourError);
        throw tourError;
      }

      const { data: updatedDate, error: dateError } = await dataLayerClient.from("tour_dates")
        .update({
          date: startDate,
          start_date: startDate,
          end_date: finalEndDate,
          tour_date_type: dbTourDateType,
          rehearsal_days: rehearsalDays,
          location_id: locationId,
          is_tour_pack_only: isTourPackOnly,
          ...buildPackageUpdatePayload(packageSizes, defaultSetIds),
        })
        .eq("id", dateId)
        .select(`
          id,
          date,
          is_tour_pack_only,
          sound_package_size,
          lights_package_size,
          video_package_size,
          sound_default_set_id,
          lights_default_set_id,
          video_default_set_id,
          location:locations (
            id,
            name
          ),
          tours (
            name
          )
        `)
        .single();

      if (dateError) {
        console.error("Error updating tour date:", dateError);
        throw dateError;
      }

      // Send push notification if tour date type changed
      if (editingTourDate && editingTourDate.tour_date_type !== tourDateType) {
        try {
          void dataLayerClient.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: `tourdate.type.changed.${tourDateType}`,
              tour_id: tourId,
              tour_date_id: dateId,
              tour_name: tourData.name,
              location_name: newLocation || (updatedDate?.location as any)?.name || '',
              old_type: editingTourDate.tour_date_type,
              new_type: tourDateType,
              url: `/tours/${tourId}`
            }
          });
        } catch (err) {
          console.error('Failed to send push notification:', err);
        }
      }

      const { data: jobs, error: jobsError } = await dataLayerClient.from("jobs")
        .update({
          title: buildTourDateJobTitle(tourData.name, newLocation, tourDateType),
          start_time: `${startDate}T06:00:00`,
          end_time: `${finalEndDate}T21:59:59`,
          location_id: locationId,
        })
        .eq("tour_date_id", dateId)
        .select("id");

      if (jobsError) {
        console.error("Error updating job:", jobsError);
        throw jobsError;
      }

      const scheduledDates = buildInclusiveDateRange(startDate, finalEndDate);

      // Update job date types for all jobs of this tour date
      if (jobs && jobs.length > 0) {
        for (const job of jobs) {
          // Delete existing job date types for this job
          await dataLayerClient.from("job_date_types")
            .delete()
            .eq("job_id", job.id);

          // Create new job date types for the updated date range
          const jobDateTypes = scheduledDates.map((date) => ({
            job_id: job.id,
            date,
            type: tourDateType,
          }));

          if (jobDateTypes.length > 0) {
            const { error: dateTypeError } = await dataLayerClient.from("job_date_types")
              .insert(jobDateTypes);
            if (dateTypeError) {
              console.error("Error updating job date types:", dateTypeError);
            }
          }
        }

        await syncJobRehearsalDatesForJobs(
          jobs.map((job) => job.id),
          scheduledDates,
          { seedMissing: tourDateType === "rehearsal" }
        );
      }

      // Sync Flex elements if date changed and flex folders exist
      const originalDate = editingTourDate?.date || editingTourDate?.start_date;
      const dateChanged = originalDate && originalDate.split('T')[0] !== startDate;
      const hasFlexFolders = foldersExistenceMap?.[dateId];
      let flexSyncHadWarningsOrError = false;

      if (dateChanged && hasFlexFolders) {
        try {
          console.log("[TourDateManagement] Date changed, syncing Flex elements...");
          const syncResult = await syncFlexElementsForTourDateChange(
            dateId,
            startDate
          );
          if (syncResult.failed > 0) {
            flexSyncHadWarningsOrError = true;
            console.warn(
              `[TourDateManagement] Flex sync completed with ${syncResult.failed} errors:`,
              syncResult.errors
            );
            toast({
              title: "Fecha actualizada con avisos",
              description: `La fecha se guardó, pero no se pudieron sincronizar ${syncResult.failed} elemento(s) de Flex.`,
              variant: "destructive",
            });
          } else if (syncResult.success > 0) {
            console.log(
              `[TourDateManagement] Flex sync completed: ${syncResult.success} elements updated`
            );
          }
        } catch (syncError: unknown) {
          flexSyncHadWarningsOrError = true;
          console.error("[TourDateManagement] Flex sync error:", syncError);
          const errorMessage = syncError instanceof Error
            ? syncError.message
            : String(syncError);
          toast({
            title: "Fecha actualizada con avisos",
            description: "La fecha se guardó, pero falló la sincronización con Flex: " + errorMessage,
            variant: "destructive",
          });
        }
      }

      // Force refresh all related queries after successful edit
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour", tourId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") }),
      ]);

      await syncTourDefaultDocumentsForDate(dateId);

      // Only show success toast if flex sync didn't have warnings or errors
      if (!flexSyncHadWarningsOrError) {
        toast({
          title: "Fecha actualizada",
          description: "La fecha de gira se actualizó correctamente.",
        });
      }
    } catch (error: any) {
      console.error("Error editing date:", error);
      toast({
        title: "Error al editar la fecha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDate = async (dateId: string) => {
    // ... keep existing code (deletion logic remains the same)
    if (isDeletingDate) return; // Prevent multiple simultaneous deletions

    setIsDeletingDate(dateId);

    try {
      console.log("Starting deletion of tour date:", dateId);

      // Step 1: Delete flex folders first
      console.log("Deleting flex folders...");
      const { error: flexFoldersError } = await dataLayerClient.from("flex_folders")
        .delete()
        .eq("tour_date_id", dateId);

      if (flexFoldersError) {
        console.error("Error deleting flex folders:", flexFoldersError);
        throw flexFoldersError;
      }

      // Step 2: Get all jobs for this tour date
      console.log("Fetching jobs for tour date...");
      const { data: jobs, error: jobsError } = await dataLayerClient.from("jobs")
        .select("id")
        .eq("tour_date_id", dateId);

      if (jobsError) {
        console.error("Error fetching jobs:", jobsError);
        throw jobsError;
      }

      console.log("Found jobs to delete:", jobs);

      // Step 3: Delete job-related data if jobs exist
      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map(j => j.id);
        console.log("Deleting job-related data for jobs:", jobIds);

        // Delete in the correct order to avoid foreign key constraints
        const deletionSteps = [
          // Task documents first
          { table: "task_documents", condition: "sound_task_id", subquery: "sound_job_tasks" },
          { table: "task_documents", condition: "lights_task_id", subquery: "lights_job_tasks" },
          { table: "task_documents", condition: "video_task_id", subquery: "video_job_tasks" },
          { table: "task_documents", condition: "production_task_id", subquery: "production_job_tasks" },
          { table: "task_documents", condition: "administrative_task_id", subquery: "administrative_job_tasks" },

          // Tasks
          { table: "sound_job_tasks", condition: "job_id" },
          { table: "lights_job_tasks", condition: "job_id" },
          { table: "video_job_tasks", condition: "job_id" },
          { table: "production_job_tasks", condition: "job_id" },
          { table: "administrative_job_tasks", condition: "job_id" },

          // Personnel
          { table: "sound_job_personnel", condition: "job_id" },
          { table: "lights_job_personnel", condition: "job_id" },
          { table: "video_job_personnel", condition: "job_id" },

          // Other job-related tables
          { table: "job_assignments", condition: "job_id" },
          { table: "job_departments", condition: "job_id" },
          { table: "job_documents", condition: "job_id" },
          { table: "logistics_events", condition: "job_id" },
          { table: "hoja_de_ruta", condition: "job_id" },
          { table: "memoria_tecnica_documents", condition: "job_id" },
          { table: "lights_memoria_tecnica_documents", condition: "job_id" },
          { table: "video_memoria_tecnica_documents", condition: "job_id" },
          { table: "job_date_types", condition: "job_id", useService: true },
          { table: "job_milestones", condition: "job_id" },
          { table: "power_requirement_tables", condition: "job_id" },
          { table: "festival_artists", condition: "job_id" },
          { table: "festival_gear_setups", condition: "job_id" },
          { table: "festival_logos", condition: "job_id" },
          { table: "festival_shifts", condition: "job_id" },
          { table: "festival_settings", condition: "job_id" },
          { table: "festival_stages", condition: "job_id" },
          { table: "technician_work_records", condition: "job_id" },

          // Newly identified child tables
          { table: "timesheets", condition: "job_id" },
          { table: "job_expenses", condition: "job_id" },
          { table: "expense_permissions", condition: "job_id" },
          { table: "job_rehearsal_dates", condition: "job_id" },
          { table: "staffing_campaigns", condition: "job_id" },
          { table: "job_technician_payout_overrides", condition: "job_id" },
          { table: "job_stage_plots", condition: "job_id" },
          { table: "job_whatsapp_groups", condition: "job_id" },
          { table: "job_whatsapp_group_requests", condition: "job_id" },
          { table: "job_required_roles", condition: "job_id" },
          { table: "presets", condition: "job_id" },
          { table: "sub_rentals", condition: "job_id" },
          { table: "job_rate_extras", condition: "job_id" },
          { table: "transport_requests", condition: "job_id" },
          { table: "staffing_requests", condition: "job_id" },
          { table: "assignment_notifications", condition: "job_id" },
          { table: "job_milestone_definitions", condition: "job_id" },
          { table: "availability_conflicts", condition: "job_id" },
          { table: "flex_crew_calls", condition: "job_id" },
          { table: "flex_work_orders", condition: "job_id" },
        ];

        for (const step of deletionSteps) {
          if (!jobIds || jobIds.length === 0) continue;

          console.log(`Deleting from ${step.table}...`);

          try {
            if (step.subquery) {
              // Handle task documents which reference task IDs
              const { data: taskIds } = await fromDynamicTable(step.subquery)
                .select("id")
                .in("job_id", jobIds);

              if (taskIds && taskIds.length > 0) {
                const { error } = await fromDynamicTable(step.table)
                  .delete()
                  .in(step.condition, taskIds.map((t: { id: string }) => t.id));

                if (error) {
                  console.error(`Error deleting from ${step.table}:`, error);
                }
              }
            } else if (step.useService && step.table === "job_date_types") {
              // Use service for job date types deletion
              for (const jobId of jobIds) {
                try {
                  await deleteJobDateTypes(jobId);
                } catch (error) {
                  console.error(`Error deleting job date types for job ${jobId}:`, error);
                }
              }
            } else {
              // Direct deletion by job_id
              const { error } = await fromDynamicTable(step.table)
                .delete()
                .in(step.condition, jobIds);

              if (error) {
                console.warn(`Warning deleting from ${step.table} (likely restricted or empty):`, error);
                // Continue with other deletions
              }
            }
          } catch (err) {
            console.error(`Unexpected error during ${step.table} deletion:`, err);
          }
        }

        // Finally delete the jobs themselves
        console.log("Deleting jobs...");
        const { error: jobsDeleteError } = await dataLayerClient.from("jobs")
          .delete()
          .in("id", jobIds);

        if (jobsDeleteError) {
          console.error("Error deleting jobs:", jobsDeleteError);
          throw jobsDeleteError;
        }
      }

      // Step 4: Delete tour date overrides
      console.log("Deleting tour date overrides...");
      await Promise.all([
        dataLayerClient.from("tour_date_power_overrides").delete().eq("tour_date_id", dateId),
        dataLayerClient.from("tour_date_weight_overrides").delete().eq("tour_date_id", dateId)
      ]);

      // Step 5: Finally delete the tour date itself
      console.log("Deleting tour date...");
      const { error: dateError } = await dataLayerClient.from("tour_dates")
        .delete()
        .eq("id", dateId);

      if (dateError) {
        console.error("Error deleting tour date:", dateError);
        throw dateError;
      }

      let defaultDocumentCleanupFailed = false;
      if (tourId) {
        try {
          await cleanupTourDefaultDocumentsForDate({ tourId, tourDateId: dateId });
        } catch (cleanupError) {
          defaultDocumentCleanupFailed = true;
          console.error("Error cleaning up tour default documents for deleted date:", cleanupError);
        }
      }

      console.log("Tour date deletion completed successfully");

      // Force refresh all related queries after successful deletion
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour", tourId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tours-with-dates") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("flex-folders-existence") }),
      ]);
      await invalidateTourDocumentQueries();

      toast({
        title: defaultDocumentCleanupFailed ? "Fecha eliminada con avisos" : "Fecha eliminada",
        description: defaultDocumentCleanupFailed
          ? "La fecha se eliminó, pero no se pudieron limpiar todos los PDF automáticos."
          : "La fecha de gira se eliminó correctamente."
      });

    } catch (error: any) {
      console.error("Error deleting date:", error);
      toast({
        title: "Error al eliminar la fecha",
        description: error.message || "Se produjo un error inesperado al eliminar la fecha de gira.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingDate(null);
    }
  };

  return { handleAddDate, handleDeleteDate, handleEditDate };
};
