import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  Plus,
  Trash2,
  FolderPlus,
  Edit,
} from "lucide-react";
import { useLocationManagement } from "@/hooks/useLocationManagement";
import { useTourDateFlexFolders } from "@/hooks/useTourDateFlexFolders";
import { useTourDateRealtime } from "@/hooks/useTourDateRealtime";
import { createAllFoldersForJob } from "@/utils/flex-folders";

interface TourDateManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
  tourDates: any[];
  readOnly?: boolean;
}

async function createFoldersForDate(
  dateObj: any,
  tourId: string | null,
  skipExistingCheck = false
) {
  try {
    console.log("Creating folders for tour date:", dateObj);

    if (!skipExistingCheck) {
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("flex_folders_created")
        .eq("tour_date_id", dateObj.id);
      if (jobsError) {
        console.error("Error checking existing jobs:", jobsError);
        throw jobsError;
      }
      if (jobs && jobs.some((j) => j.flex_folders_created)) {
        console.log("Skipping date – folders already exist:", dateObj.date);
        return false;
      }
    }

    // Get the associated job for this tour date
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        location:locations (
          id,
          name
        ),
        job_departments (
          department
        )
      `)
      .eq('tour_date_id', dateObj.id)
      .single();

    if (jobError || !job) {
      throw new Error(`No job found for tour date ${dateObj.id}`);
    }

    // Format dates using the same approach as JobCardNew
    const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
    const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";
    
    // Generate document number using the same logic as JobCardNew
    const startDate = new Date(job.start_time);
    const documentNumber = startDate
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, "");

    // Use the working folder creation function from utils
    await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);

    // Mark job as having folders created
    const { error: updateError } = await supabase
      .from("jobs")
      .update({ flex_folders_created: true })
      .eq("id", job.id);

    if (updateError) {
      console.error("Error updating job folder status:", updateError);
      throw updateError;
    }

    // Also update the tour_date record
    const { error: tourDateUpdateError } = await supabase
      .from("tour_dates")
      .update({ flex_folders_created: true })
      .eq("id", dateObj.id);
    
    if (tourDateUpdateError) {
      console.error("Error updating tour date:", tourDateUpdateError);
      throw tourDateUpdateError;
    }

    return true;
  } catch (error: any) {
    console.error("Error creating folders for tour date:", error);
    throw error;
  }
}

export const TourDateManagementDialog: React.FC<TourDateManagementDialogProps> = ({
  open,
  onOpenChange,
  tourId,
  tourDates = [],
  readOnly = false,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOrCreateLocation } = useLocationManagement();
  const { 
    createIndividualFolders, 
    createAllFolders, 
    isCreatingAll, 
    isCreatingIndividual 
  } = useTourDateFlexFolders(tourId || '');

  // Add real-time subscriptions
  const tourDateIds = tourDates.map(d => d.id);
  useTourDateRealtime(tourId, tourDateIds);

  // Force refresh parent component data when dialog opens
  useEffect(() => {
    if (open && tourId) {
      console.log('Dialog opened, refreshing tour data');
      queryClient.invalidateQueries({ queryKey: ['tour', tourId] });
    }
  }, [open, tourId, queryClient]);

  const [editingTourDate, setEditingTourDate] = useState<any>(null);
  const [editDateValue, setEditDateValue] = useState<string>("");
  const [editLocationValue, setEditLocationValue] = useState<string>("");
  const [isDeletingDate, setIsDeletingDate] = useState<string | null>(null);

  const { data: foldersExistenceMap, refetch: refetchFoldersExistence } = useQuery({
    queryKey: ["flex-folders-existence", tourDateIds],
    queryFn: async () => {
      if (!tourDates.length) return {};

      const { data, error } = await supabase
        .from("flex_folders")
        .select("tour_date_id")
        .in("tour_date_id", tourDateIds);

      if (error) throw error;

      return data.reduce((acc: Record<string, boolean>, folder) => {
        acc[folder.tour_date_id] = true;
        return acc;
      }, {});
    },
    enabled: tourDates.length > 0,
  });

  const handleAddDate = async (date: string, location: string) => {
    try {
      if (!tourId) {
        throw new Error("Tour ID is required");
      }
      console.log("Adding new tour date:", { date, location, tourId });
      
      const locationId = await getOrCreateLocation(location);
      console.log("Location ID:", locationId);
      const { data: newTourDate, error: tourDateError } = await supabase
        .from("tour_dates")
        .insert({
          tour_id: tourId,
          date,
          location_id: locationId,
        })
        .select(`
          id,
          date,
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

      const { data: tourData, error: tourError } = await supabase
        .from("tours")
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

      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          title: `${tourData.name} (${location || 'No Location'})`,
          start_time: `${date}T00:00:00`,
          end_time: `${date}T23:59:59`,
          location_id: locationId,
          tour_date_id: newTourDate.id,
          tour_id: tourId,
          color: tourData.color || "#7E69AB",
          job_type: "tourdate",
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
        ) || ["sound", "lights", "video"];
      const jobDepartments = departments.map((department) => ({
        job_id: newJob.id,
        department,
      }));
      const { error: deptError } = await supabase
        .from("job_departments")
        .insert(jobDepartments);
      if (deptError) {
        console.error("Error creating job departments:", deptError);
        throw deptError;
      }

      // Force refresh all related queries after successful creation
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tour", tourId] }),
        queryClient.invalidateQueries({ queryKey: ["tours"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["flex-folders-existence"] }),
      ]);

      toast({
        title: "Success",
        description: "Tour date and job created successfully",
      });
    } catch (error: any) {
      console.error("Error adding date:", error);
      toast({
        title: "Error adding date",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditDate = async (
    dateId: string,
    newDate: string,
    newLocation: string
  ) => {
    try {
      if (!tourId) {
        throw new Error("Tour ID is required");
      }
      console.log("Editing tour date:", { dateId, newDate, newLocation });
      const locationId = await getOrCreateLocation(newLocation);

      const { data: tourData, error: tourError } = await supabase
        .from("tours")
        .select("name")
        .eq("id", tourId)
        .single();

      if (tourError) {
        console.error("Error fetching tour:", tourError);
        throw tourError;
      }

      const { data: updatedDate, error: dateError } = await supabase
        .from("tour_dates")
        .update({
          date: newDate,
          location_id: locationId,
        })
        .eq("id", dateId)
        .select(`
          id,
          date,
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

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .update({
          title: `${tourData.name} (${newLocation || 'No Location'})`,
          start_time: `${newDate}T00:00:00`,
          end_time: `${newDate}T23:59:59`,
          location_id: locationId,
        })
        .eq("tour_date_id", dateId);

      if (jobsError) {
        console.error("Error updating job:", jobsError);
        throw jobsError;
      }

      // Force refresh all related queries after successful edit
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tour", tourId] }),
        queryClient.invalidateQueries({ queryKey: ["tours"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
      ]);

      toast({
        title: "Success",
        description: "Tour date updated successfully",
      });
    } catch (error: any) {
      console.error("Error editing date:", error);
      toast({
        title: "Error editing date",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDate = async (dateId: string) => {
    if (isDeletingDate) return; // Prevent multiple simultaneous deletions

    setIsDeletingDate(dateId);

    try {
      console.log("Starting deletion of tour date:", dateId);

      // Step 1: Delete flex folders first
      console.log("Deleting flex folders...");
      const { error: flexFoldersError } = await supabase
        .from("flex_folders")
        .delete()
        .eq("tour_date_id", dateId);

      if (flexFoldersError) {
        console.error("Error deleting flex folders:", flexFoldersError);
        throw flexFoldersError;
      }

      // Step 2: Get all jobs for this tour date
      console.log("Fetching jobs for tour date...");
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
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

          // Tasks
          { table: "sound_job_tasks", condition: "job_id" },
          { table: "lights_job_tasks", condition: "job_id" },
          { table: "video_job_tasks", condition: "job_id" },

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
          { table: "job_date_types", condition: "job_id" },
          { table: "job_milestones", condition: "job_id" },
          { table: "power_requirement_tables", condition: "job_id" },
          { table: "festival_artists", condition: "job_id" },
          { table: "festival_gear_setups", condition: "job_id" },
          { table: "festival_logos", condition: "job_id" },
          { table: "festival_shifts", condition: "job_id" },
          { table: "festival_settings", condition: "job_id" },
          { table: "festival_stages", condition: "job_id" },
          { table: "technician_work_records", condition: "job_id" },
        ];

        for (const step of deletionSteps) {
          console.log(`Deleting from ${step.table}...`);

          if (step.subquery) {
            // Handle task documents which reference task IDs
            const { data: taskIds } = await supabase
              .from(step.subquery)
              .select("id")
              .in("job_id", jobIds);

            if (taskIds && taskIds.length > 0) {
              const { error } = await supabase
                .from(step.table)
                .delete()
                .in(step.condition, taskIds.map(t => t.id));

              if (error) {
                console.error(`Error deleting from ${step.table}:`, error);
                // Continue with other deletions even if one fails
              }
            }
          } else {
            // Direct deletion by job_id
            const { error } = await supabase
              .from(step.table)
              .delete()
              .in(step.condition, jobIds);

            if (error) {
              console.error(`Error deleting from ${step.table}:`, error);
              // Continue with other deletions even if one fails
            }
          }
        }

        // Finally delete the jobs themselves
        console.log("Deleting jobs...");
        const { error: jobsDeleteError } = await supabase
          .from("jobs")
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
        supabase.from("tour_date_power_overrides").delete().eq("tour_date_id", dateId),
        supabase.from("tour_date_weight_overrides").delete().eq("tour_date_id", dateId)
      ]);

      // Step 5: Finally delete the tour date itself
      console.log("Deleting tour date...");
      const { error: dateError } = await supabase
        .from("tour_dates")
        .delete()
        .eq("id", dateId);

      if (dateError) {
        console.error("Error deleting tour date:", dateError);
        throw dateError;
      }

      console.log("Tour date deletion completed successfully");

      // Force refresh all related queries after successful deletion
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tour", tourId] }),
        queryClient.invalidateQueries({ queryKey: ["tours"] }),
        queryClient.invalidateQueries({ queryKey: ["tours-with-dates"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["flex-folders-existence"] }),
      ]);

      toast({
        title: "Success",
        description: "Tour date deleted successfully"
      });

    } catch (error: any) {
      console.error("Error deleting date:", error);
      toast({
        title: "Error deleting date",
        description: error.message || "An unexpected error occurred while deleting the tour date",
        variant: "destructive",
      });
    } finally {
      setIsDeletingDate(null);
    }
  };

  const startEditing = (dateObj: any) => {
    setEditingTourDate(dateObj);
    setEditDateValue(dateObj.date.split("T")[0]);
    setEditLocationValue(dateObj.location?.name || "");
  };

  const cancelEditing = () => {
    setEditingTourDate(null);
    setEditDateValue("");
    setEditLocationValue("");
  };

  const submitEditing = async (dateId: string) => {
    await handleEditDate(dateId, editDateValue, editLocationValue);
    cancelEditing();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? 'Tour Dates' : 'Manage Tour Dates'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4">
            {!readOnly && tourDates.length > 0 && (
              <Button
                onClick={() => createAllFolders(tourDates)}
                className="w-full"
                variant="outline"
                disabled={isCreatingAll}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                {isCreatingAll ? 'Creating Folders...' : 'Create Folders for All Dates'}
              </Button>
            )}
            
            <div className="space-y-4">
              {tourDates?.map((dateObj) => {
                const foldersExist = foldersExistenceMap?.[dateObj.id] || false;
                const isDeleting = isDeletingDate === dateObj.id;
                const isCreatingFolders = isCreatingIndividual === dateObj.id;

                return (
                  <div key={dateObj.id} className="p-3 border rounded-lg">
                    {editingTourDate && editingTourDate.id === dateObj.id && !readOnly ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <Input
                            type="date"
                            value={editDateValue}
                            onChange={(e) => setEditDateValue(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <Input
                            type="text"
                            value={editLocationValue}
                            onChange={(e) => setEditLocationValue(e.target.value)}
                            placeholder="Location"
                            required
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => submitEditing(dateObj.id)}>
                            Save
                          </Button>
                          <Button variant="outline" onClick={cancelEditing}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(dateObj.date), "MMM d, yyyy")}</span>
                          </div>
                          {dateObj.location?.name && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>{dateObj.location.name}</span>
                            </div>
                          )}
                          {foldersExist && (
                            <div className="text-xs text-green-600">
                              ✓ Flex folders created
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!readOnly && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => createIndividualFolders(dateObj)}
                                title="Create Flex folders"
                                disabled={foldersExist || isCreatingFolders}
                                className={foldersExist ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                {isCreatingFolders ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <FolderPlus className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditing(dateObj)}
                                title="Edit Date"
                                disabled={isDeleting}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDate(dateObj.id)}
                                title="Delete Date"
                                disabled={isDeleting}
                                className={isDeleting ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                {isDeleting ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {!readOnly && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const date = formData.get("date") as string;
                  const location = formData.get("location") as string;
                  if (!date || !location) {
                    toast({
                      title: "Error",
                      description: "Please fill in all fields",
                      variant: "destructive",
                    });
                    return;
                  }
                  handleAddDate(date, location);
                  e.currentTarget.reset();
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <Input type="date" name="date" required />
                  <Input type="text" name="location" placeholder="Location" required />
                </div>
                <Button type="submit" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Date
                </Button>
              </form>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
