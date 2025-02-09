import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
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

// ----------------------------------------------------------------
// Constants for Flex folder creation – these values must match your system.
// ----------------------------------------------------------------
const BASE_URL = "https://sectorpro.flexrentalsolutions.com/f5/api/element";
const API_KEY = "82b5m0OKgethSzL1YbrWMUFvxdNkNMjRf82E";

const FLEX_FOLDER_IDS = {
  subFolder: "358f312c-b051-11df-b8d5-00e08175e43e",
  location: "2f49c62c-b139-11df-b8d5-00e08175e43e",
  documentacionTecnica: "3787806c-af2d-11df-b8d5-00e08175e43e",
  presupuestosRecibidos: "3787806c-af2d-11df-b8d5-00e08175e43e",
  hojaGastos: "566d32e0-1a1e-11e0-a472-00e08175e43e",
  crewCall: "253878cc-af31-11df-b8d5-00e08175e43e",
  pullSheet: "a220432c-af33-11df-b8d5-00e08175e43e",
};

const DEPARTMENT_IDS = {
  sound: "cdd5e372-d124-11e1-bba1-00e08175e43e",
  lights: "d5af7892-d124-11e1-bba1-00e08175e43e",
  video: "a89d124d-7a95-4384-943e-49f5c0f46b23",
  production: "890811c3-fe3f-45d7-af6b-7ca4a807e84d",
  personnel: "b972d682-598d-4802-a390-82e28dc4480e",
};

const RESPONSIBLE_PERSON_IDS = {
  sound: "4b0d98e0-e700-11ea-97d0-2a0a4490a7fb",
  lights: "4b559e60-e700-11ea-97d0-2a0a4490a7fb",
  video: "bb9690ac-f22e-4bc4-94a2-6d341ca0138d",
  production: "4ce97ce3-5159-401a-9cf8-542d3e479ade",
  personnel: "4b618540-e700-11ea-97d0-2a0a4490a7fb",
};

const DEPARTMENT_SUFFIXES = {
  sound: "S",
  lights: "L",
  video: "V",
  production: "P",
  personnel: "HR",
};

interface TourDateManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string | null;
  tourDates: any[];
}

// ----------------------------------------------------------------
// Helper: createFlexFolder
// Calls the Flex API with a payload and returns its JSON response.
// ----------------------------------------------------------------
async function createFlexFolder(payload: Record<string, any>) {
  console.log("Creating Flex folder with payload:", payload);
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json();
    console.error("Flex folder creation error:", errorData);
    throw new Error(
      errorData.exceptionMessage || "Failed to create folder in Flex"
    );
  }
  const data = await response.json();
  console.log("Created Flex folder:", data);
  return data;
}

// ----------------------------------------------------------------
// Function: createFoldersForDate
//
// For a given tour date and tour ID, this function creates the folder structure.
// For each department it:
//   1. Retrieves the tour’s parent folder record.
//   2. Creates a main tour date folder via the Flex API (using the parent's element ID),
//      and captures the returned element ID as mainFolderElementId.
//   3. Inserts a record (folder_type "tourdate") for the main folder.
//   4. Creates subfolders (nested under the main folder by using mainFolderElementId as parentElementId):
//      - For non-personnel: "Documentación Técnica" (DT), "Presupuestos Recibidos" (PR), and "Hoja de Gastos" (HG)
//      - For Sound: extra subfolders "Tour Pack" (TP) and "PA" (PA)
//      - For Personnel: a "Gastos de Personal" subfolder (GP) plus crew call subfolders
//        ("Crew Call Sonido" [CCS] and "Crew Call Luces" [CCL]).
//   5. Finally, updates the tour date record (flex_folders_created = true).
// ----------------------------------------------------------------
async function createFoldersForDate(
  dateObj: any,
  tourId: string | null,
  skipExistingCheck = false
) {
  try {
    console.log("Creating folders for tour date:", dateObj);

    // Check if folders already exist for this tour date
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

    // Retrieve tour data using the proper tourId.
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

    // Prepare date values and document number.
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

    // Loop through each department.
    for (const dept of departments) {
      const parentFolderId = tourData[`flex_${dept}_folder_id`];
      const capitalizedDept = dept.charAt(0).toUpperCase() + dept.slice(1);
      if (!parentFolderId) {
        console.warn(`No parent folder ID found for ${dept} department`);
        continue;
      }

      // Retrieve the local parent folder record.
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

      // Create the main tour date folder via Flex API.
      const mainFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: parentFolderId, // nest under the tour's department folder
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

      // Insert the main folder record into Supabase.
      await supabase.from("flex_folders").insert({
        tour_date_id: dateObj.id,
        parent_id: parentRow.id,
        element_id: mainFolderElementId,
        department: dept,
        folder_type: "tourdate",
      });

      // Create subfolders inside the main tour date folder using mainFolderElementId.
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
          await supabase.from("flex_folders").insert({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subResponse.elementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }

      // For Sound, create extra subfolders ("Tour Pack" and "PA")
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
          await supabase.from("flex_folders").insert({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subResponse.elementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }

      // For Personnel, create a "Gastos de Personal" subfolder and Crew Call subfolders.
      if (dept === "personnel") {
        // Gastos de Personal
        const personnelSubfolders = [
          { name: `Gastos de Personal - ${tourData.name}`, suffix: "GP" },
        ];
        for (const sf of personnelSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.subFolder,
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
          await supabase.from("flex_folders").insert({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subResponse.elementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
        // Crew Call subfolders
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
          await supabase.from("flex_folders").insert({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subResponse.elementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }
    }

    // Finally, update the tour date record to mark folders as created.
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

// ----------------------------------------------------------------
// TourDateManagementDialog Component
// ----------------------------------------------------------------
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

  // Inline editing state
  const [editingTourDate, setEditingTourDate] = useState<any>(null);
  const [editDateValue, setEditDateValue] = useState<string>("");
  const [editLocationValue, setEditLocationValue] = useState<string>("");

  // Prevent multiple triggers for folder creation by tracking tour dates that have had folders created
  const [createdTourDateIds, setCreatedTourDateIds] = useState<string[]>([]);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);

  // Handler: Create folders for a single tour date and update local state if successful.
  const handleCreateFoldersForDate = async (dateObj: any) => {
    if (dateObj.flex_folders_created || createdTourDateIds.includes(dateObj.id)) return;
    try {
      await createFoldersForDate(dateObj, tourId, true);
      setCreatedTourDateIds((prev) => [...prev, dateObj.id]);
      toast({
        title: "Success",
        description: "Folders created for this tour date.",
      });
    } catch (error: any) {
      console.error("Error creating folders for tour date:", error);
      toast({
        title: "Error creating folders",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handler: Bulk create folders for all tour dates.
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

  // Handler: Add a new tour date.
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

      // Retrieve the tour record using the proper tourId.
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

      // Create the job record as a tour date job.
      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          title: `${tourData.name} (Tour Date)`,
          start_time: `${date}T00:00:00`,
          end_time: `${date}T23:59:59`,
          location_id: locationId,
          tour_date_id: newTourDate.id,
          tour_id: tourId, // Ensure proper linking
          color: tourData.color || "#7E69AB",
          job_type: "tourdate", // Use "tourdate" to trigger proper folder creation logic
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

  // Handler: Edit an existing tour date.
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
      const { data, error } = await supabase
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
          )
        `)
        .single();
      if (error) {
        console.error("Error updating tour date:", error);
        throw error;
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

  // Handler: Delete a tour date (and its associated job records).
  const handleDeleteDate = async (dateId: string) => {
    try {
      console.log("Starting deletion of tour date:", dateId);
      
      // First, delete flex_folders records
      const { error: flexFoldersError } = await supabase
        .from("flex_folders")
        .delete()
        .eq("tour_date_id", dateId);
        
      if (flexFoldersError) {
        console.error("Error deleting flex folders:", flexFoldersError);
        throw flexFoldersError;
      }

      // Then get and delete jobs and their dependencies
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id")
        .eq("tour_date_id", dateId);
        
      if (jobsError) throw jobsError;
      
      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map(j => j.id);
        
        // Delete job assignments
        const { error: assignmentsError } = await supabase
          .from("job_assignments")
          .delete()
          .in("job_id", jobIds);
          
        if (assignmentsError) throw assignmentsError;
        
        // Delete job departments
        const { error: departmentsError } = await supabase
          .from("job_departments")
          .delete()
          .in("job_id", jobIds);
          
        if (departmentsError) throw departmentsError;
        
        // Delete jobs
        const { error: jobsDeleteError } = await supabase
          .from("jobs")
          .delete()
          .in("id", jobIds);
          
        if (jobsDeleteError) throw jobsDeleteError;
      }

      // Finally delete the tour date
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

  // Inline editing handlers.
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
      <DialogContent className="max-h-[90vh] md:max-h-none md:h-auto overflow-y-auto md:overflow-visible">
        <DialogHeader>
          <DialogTitle>Manage Tour Dates</DialogTitle>
        </DialogHeader>
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
            {tourDates?.map((dateObj) => (
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
  disabled={dateObj.flex_folders_created || createdTourDateIds.includes(dateObj.id)}
  className={(dateObj.flex_folders_created || createdTourDateIds.includes(dateObj.id)) ? "opacity-50 cursor-not-allowed" : ""}
>
  <FolderPlus className="h-4 w-4" />
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
            ))}
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
      </DialogContent>
    </Dialog>
  );
};
