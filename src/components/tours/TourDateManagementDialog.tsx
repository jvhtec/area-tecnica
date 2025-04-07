import React, { useState } from "react";
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
  Battery,
} from "lucide-react";
import { useLocationManagement } from "@/hooks/useLocationManagement";
import { BatterySalesDialog } from "./BatterySalesDialog";

import {
  FLEX_FOLDER_IDS,
  DEPARTMENT_IDS,
  RESPONSIBLE_PERSON_IDS,
  DEPARTMENT_SUFFIXES,
} from "@/utils/flex-folders/constants";

import { createFlexFolder } from "@/utils/flex-folders/api";

interface TourDateManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
  tourDates: any[];
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

    const { data: tourData, error: tourError } = await supabase
      .from("tours")
      .select(`
        name,
        flex_main_folder_id,
        flex_sound_folder_id,
        flex_lights_folder_id,
        flex_video_folder_id,
        flex_production_folder_id,
        flex_personnel_folder_id
      `)
      .eq("id", tourId)
      .single();
    if (tourError) {
      console.error("Error fetching tour:", tourError);
      throw tourError;
    }
    if (!tourData || !tourData.flex_main_folder_id) {
      throw new Error(
        "Parent tour folders not found. Please create tour folders first."
      );
    }

    const formattedStartDate =
      new Date(dateObj.date).toISOString().split(".")[0] + ".000Z";
    const formattedEndDate = formattedStartDate;
    const documentNumber = new Date(dateObj.date)
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, "");
    const formattedDate = format(new Date(dateObj.date), "MMM d, yyyy");
    const locationName = dateObj.location?.name || "No Location";

    const departments: (keyof typeof DEPARTMENT_IDS)[] = [
      "sound",
      "lights",
      "video",
      "production",
      "personnel",
    ];

    for (const dept of departments) {
      const parentFolderId = tourData[`flex_${dept}_folder_id`];
      const capitalizedDept = dept.charAt(0).toUpperCase() + dept.slice(1);
      if (!parentFolderId) {
        console.warn(`No parent folder ID found for ${dept} department`);
        continue;
      }

      const { data: parentRows, error: parentErr } = await supabase
        .from("flex_folders")
        .select("*")
        .eq("element_id", parentFolderId)
        .limit(1);
      if (parentErr) {
        console.error("Error fetching parent row:", parentErr);
        continue;
      }
      if (!parentRows || parentRows.length === 0) {
        console.warn(`No local record found for parent element_id=${parentFolderId}`);
        continue;
      }
      const parentRow = parentRows[0];

      const mainFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: parentFolderId,
        open: true,
        locked: false,
        name: `${locationName} - ${formattedDate} - ${capitalizedDept}`,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
      };
      console.log(`Creating main tour date folder for ${dept}:`, mainFolderPayload);
      const mainFolderResponse = await createFlexFolder(mainFolderPayload);
      const mainFolderElementId = mainFolderResponse.elementId;

      await supabase.from("flex_folders").insert({
        tour_date_id: dateObj.id,
        parent_id: parentRow.id,
        element_id: mainFolderElementId,
        department: dept,
        folder_type: "tourdate",
      });

      if (dept !== "personnel") {
        const subfolders = [
          {
            definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
            name: `Documentación Técnica - ${capitalizedDept}`,
            suffix: "DT",
          },
          {
            definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
            name: `Presupuestos Recibidos - ${capitalizedDept}`,
            suffix: "PR",
          },
          {
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
            name: `Hoja de Gastos - ${capitalizedDept}`,
            suffix: "HG",
          },
        ];
        for (const sf of subfolders) {
          const subPayload = {
            definitionId: sf.definitionId,
            parentElementId: mainFolderElementId,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            departmentId: DEPARTMENT_IDS[dept],
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${sf.suffix}`,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept]
          };
          console.log(`Creating subfolder ${sf.name} for ${dept}:`, subPayload);
          const subResponse = await createFlexFolder(subPayload);
          const subFolderElementId = subResponse.elementId;
          await supabase.from("flex_folders").insert({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subFolderElementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }

      if (["sound", "lights", "video"].includes(dept)) {
        const job = { title: 'Default Job Title' };
        const hojaInfoType = dept === "sound"
          ? FLEX_FOLDER_IDS.hojaInfoSx
          : dept === "lights"
            ? FLEX_FOLDER_IDS.hojaInfoLx
            : FLEX_FOLDER_IDS.hojaInfoVx;

        const hojaInfoSuffix = dept === "sound" ? "SIP" : dept === "lights" ? "LIP" : "VIP";

        const hojaInfoPayload = {
          definitionId: hojaInfoType,
          parentElementId: mainFolderElementId,
          open: true,
          locked: false,
          name: `Hoja de Información - ${job.title}`,
          plannedStartDate: formattedStartDate,
          plannedEndDate: formattedEndDate,
          locationId: FLEX_FOLDER_IDS.location,
          departmentId: DEPARTMENT_IDS[dept as keyof typeof DEPARTMENT_IDS],
          documentNumber: `${documentNumber}${hojaInfoSuffix}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as keyof typeof RESPONSIBLE_PERSON_IDS],
        };

        console.log(`Creating hojaInfo element for ${dept}:`, hojaInfoPayload);
        await createFlexFolder(hojaInfoPayload);
      }

      if (dept === "sound") {
        const soundSubfolders = [
          { name: `${tourData.name} - Tour Pack`, suffix: "TP" },
          { name: `${tourData.name} - PA`, suffix: "PA" },
        ];
        for (const sf of soundSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.pullSheet,
            parentElementId: mainFolderElementId,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${sf.suffix}`,
            departmentId: DEPARTMENT_IDS[dept],
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
          };
          console.log(`Creating sound extra subfolder ${sf.name}:`, subPayload);
          const subResponse = await createFlexFolder(subPayload);
          const subFolderElementId = subResponse.elementId;
          await supabase.from("flex_folders").insert({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subFolderElementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }

      if (dept === "personnel") {
        const personnelSubfolders = [
          { name: `Gastos de Personal - ${tourData.name}`, suffix: "GP" },
        ];
        for (const sf of personnelSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
            parentElementId: mainFolderElementId,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${sf.suffix}`,
            departmentId: DEPARTMENT_IDS[dept],
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
          };
          console.log(`Creating personnel subfolder ${sf.name}:`, subPayload);
          const subResponse = await createFlexFolder(subPayload);
          const subFolderElementId = subResponse.elementId;
          await supabase.from("flex_folders").insert({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subFolderElementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
        const personnelCrewCall = [
          { name: `Crew Call Sonido - ${tourData.name}`, suffix: "CCS" },
          { name: `Crew Call Luces - ${tourData.name}`, suffix: "CCL" },
        ];
        for (const sf of personnelCrewCall) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.crewCall,
            parentElementId: mainFolderElementId,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${sf.suffix}`,
            departmentId: DEPARTMENT_IDS[dept],
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
          };
          console.log(`Creating personnel crew call subfolder ${sf.name}:`, subPayload);
          const subResponse = await createFlexFolder(subPayload);
          const subFolderElementId = subResponse.elementId;
          await supabase.from("flex_folders").insert({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subFolderElementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }
    }

    const { error: updateError } = await supabase
      .from("tour_dates")
      .update({ flex_folders_created: true })
      .eq("id", dateObj.id);
    if (updateError) {
      console.error("Error updating tour date:", updateError);
      throw updateError;
    }
    return true;
  } catch (error: any) {
    console.error("Error creating folders for tour date:", error);
    throw error;
  }
}

interface TourDateManagementDialogInternalProps extends TourDateManagementDialogProps {}

export const TourDateManagementDialog: React.FC<TourDateManagementDialogInternalProps> = ({
  open,
  onOpenChange,
  tourId,
  tourDates = [],
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOrCreateLocation } = useLocationManagement();

  const [editingTourDate, setEditingTourDate] = useState<any>(null);
  const [editDateValue, setEditDateValue] = useState<string>("");
  const [editLocationValue, setEditLocationValue] = useState<string>("");

  const [createdTourDateIds, setCreatedTourDateIds] = useState<string[]>([]);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  
  const [batterySalesOpen, setBatterySalesOpen] = useState(false);
  const [selectedTourDateId, setSelectedTourDateId] = useState<string | null>(null);

  const { data: foldersExistenceMap } = useQuery({
    queryKey: ["flex-folders-existence", tourDates.map(d => d.id)],
    queryFn: async () => {
      if (!tourDates.length) return {};

      const { data, error } = await supabase
        .from("flex_folders")
        .select("tour_date_id")
        .in("tour_date_id", tourDates.map(d => d.id));

      if (error) throw error;

      return data.reduce((acc: Record<string, boolean>, folder) => {
        acc[folder.tour_date_id] = true;
        return acc;
      }, {});
    },
    enabled: tourDates.length > 0,
  });

  const handleCreateFoldersForDate = async (dateObj: any) => {
    if (dateObj.flex_folders_created || createdTourDateIds.includes(dateObj.id)) return;

    try {
      const { data: existingFolders } = await supabase
        .from("flex_folders")
        .select("id")
        .eq("tour_date_id", dateObj.id);

      if (existingFolders?.length > 0) {
        toast({
          title: "Folders already exist",
          description: "Flex folders have already been created for this tour date.",
          variant: "destructive"
        });
        return;
      }

      await createFoldersForDate(dateObj, tourId, true);
      setCreatedTourDateIds((prev) => [...prev, dateObj.id]);

      queryClient.invalidateQueries({ queryKey: ["flex-folders"] });
      queryClient.invalidateQueries({ queryKey: ["tours"] });

      toast({
        title: "Success",
        description: "Folders created for this tour date."
      });
    } catch (error: any) {
      console.error("Error creating folders for tour date:", error);
      toast({
        title: "Error creating folders",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const createAllFolders = async () => {
    if (isCreatingFolders) return;
    setIsCreatingFolders(true);
    try {
      let successCount = 0;
      let skipCount = 0;
      for (const dateObj of tourDates) {
        if (dateObj.flex_folders_created || createdTourDateIds.includes(dateObj.id)) {
          skipCount++;
          continue;
        }
        try {
          const created = await createFoldersForDate(dateObj, tourId, true);
          if (created) {
            setCreatedTourDateIds((prev) => [...prev, dateObj.id]);
            successCount++;
          } else {
            skipCount++;
          }
        } catch (error) {
          console.error(
            `Error creating folders for date ${dateObj.date}:`,
            error
          );
          continue;
        }
      }
      toast({
        title: "Folders Creation Complete",
        description: `Folders created for ${successCount} dates. ${skipCount} dates were skipped.`,
      });
    } catch (error: any) {
      console.error("Error creating folders for all dates:", error);
      toast({
        title: "Error creating folders",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingFolders(false);
    }
  };

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

      await queryClient.invalidateQueries({ queryKey: ["tours"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });

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

      toast({
        title: "Success",
        description: "Tour date updated successfully",
      });
      await queryClient.invalidateQueries({ queryKey: ["tours"] });
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
    try {
      console.log("Starting deletion of tour date:", dateId);

      const { error: flexFoldersError } = await supabase
        .from("flex_folders")
        .delete()
        .eq("tour_date_id", dateId);

      if (flexFoldersError) {
        console.error("Error deleting flex folders:", flexFoldersError);
        throw flexFoldersError;
      }

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id")
        .eq("tour_date_id", dateId);

      if (jobsError) throw jobsError;

      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map(j => j.id);

        const { error: assignmentsError } = await supabase
          .from("job_assignments")
          .delete()
          .in("job_id", jobIds);

        if (assignmentsError) throw assignmentsError;

        const { error: departmentsError } = await supabase
          .from("job_departments")
          .delete()
          .in("job_id", jobIds);

        if (departmentsError) throw departmentsError;

        const { error: jobsDeleteError } = await supabase
          .from("jobs")
          .delete()
          .in("id", jobIds);

        if (jobsDeleteError) throw jobsDeleteError;
      }

      const { error: dateError } = await supabase
        .from("tour_dates")
        .delete()
        .eq("id", dateId);

      if (dateError) throw dateError;

      await queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({
        title: "Success",
        description: "Tour date deleted successfully"
      });
    } catch (error: any) {
      console.error("Error deleting date:", error);
      toast({
        title: "Error deleting date",
        description: error.message,
        variant: "destructive",
      });
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

  const startBatterySales = (dateId: string) => {
    setSelectedTourDateId(dateId);
    setBatterySalesOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage Tour Dates</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4">
            {tourDates.length > 0 && (
              <Button
                onClick={createAllFolders}
                className="w-full"
                variant="outline"
                disabled={isCreatingFolders}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Folders for All Dates
              </Button>
            )}
            <div className="space-y-4">
              {tourDates?.map((dateObj) => {
                const foldersExist = foldersExistenceMap?.[dateObj.id] || false;

                return (
                  <div key={dateObj.id} className="p-3 border rounded-lg">
                    {editingTourDate && editingTourDate.id === dateObj.id ? (
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
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCreateFoldersForDate(dateObj)}
                            title="Create Flex folders"
                            disabled={dateObj.flex_folders_created || createdTourDateIds.includes(dateObj.id) || foldersExist}
                            className={(dateObj.flex_folders_created || createdTourDateIds.includes(dateObj.id) || foldersExist) ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            <FolderPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startBatterySales(dateObj.id)}
                            title="Battery Sales"
                          >
                            <Battery className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEditing(dateObj)}
                            title="Edit Date"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDate(dateObj.id)}
                            title="Delete Date"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
          </div>
        </ScrollArea>
      </DialogContent>
      
      <BatterySalesDialog 
        open={batterySalesOpen}
        onOpenChange={setBatterySalesOpen}
        tourDateId={selectedTourDateId}
      />
    </Dialog>
  );
};
