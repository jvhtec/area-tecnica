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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Package,
  Clock,
  Music,
} from "lucide-react";
import { TourDateFormFields } from "./TourDateFormFields";
import { TourDateListItem } from "./TourDateListItem";
import { useLocationManagement, LocationDetails } from "@/hooks/useLocationManagement";
import { useTourDateRealtime } from "@/hooks/useTourDateRealtime";
import {
  FLEX_FOLDER_IDS,
  DEPARTMENT_IDS,
  RESPONSIBLE_PERSON_IDS,
  DEPARTMENT_SUFFIXES,
} from "@/utils/flex-folders/constants";
import { createFlexFolder } from "@/utils/flex-folders/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { deleteJobDateTypes } from "@/services/deleteJobDateTypes";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";

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

      // Create department-specific hojaInfo elements for sound, lights, and video
      if (["sound", "lights", "video"].includes(dept)) {
        const job = { title: 'Default Job Title' }; // Define the job variable
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
        // Check if this is a tour pack only date
        const isTourPackOnly = dateObj.is_tour_pack_only;
        console.log(`Tour pack only setting for ${dateObj.date}:`, isTourPackOnly);

        const soundSubfolders = [
          { name: `${tourData.name} - Tour Pack`, suffix: "TP" },
        ];

        // Only add PA if not tour pack only
        if (!isTourPackOnly) {
          soundSubfolders.push({ name: `${tourData.name} - PA`, suffix: "PA" });
        }

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
        // ... keep existing code (personnel subfolder creation)
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

export const TourDateManagementDialog: React.FC<TourDateManagementDialogProps> = ({
  open,
  onOpenChange,
  tourId,
  tourDates = [],
  readOnly = false,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOrCreateLocation, getOrCreateLocationWithDetails } = useLocationManagement();

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
  const [editLocationValue, setEditLocationValue] = useState<string>("");
  const [editTourDateType, setEditTourDateType] = useState<'show' | 'rehearsal' | 'travel'>('show');
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [editTourPackOnly, setEditTourPackOnly] = useState<boolean>(false);
  const [isDeletingDate, setIsDeletingDate] = useState<string | null>(null);
  const [createdTourDateIds, setCreatedTourDateIds] = useState<string[]>([]);
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  
  // New date form state
  const [newLocation, setNewLocation] = useState<string>("");
  const [newLocationDetails, setNewLocationDetails] = useState<LocationDetails | null>(null);
  const [newTourDateType, setNewTourDateType] = useState<'show' | 'rehearsal' | 'travel'>('show');
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [newTourPackOnly, setNewTourPackOnly] = useState<boolean>(false);
  const [editLocationDetails, setEditLocationDetails] = useState<LocationDetails | null>(null);

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

  const handleAddDate = async (
    location: string, 
    tourDateType: 'show' | 'rehearsal' | 'travel' = 'show',
    startDate: string,
    endDate: string,
    isTourPackOnly: boolean = false
  ) => {
    try {
      if (!tourId) {
        throw new Error("Tour ID is required");
      }
      const finalEndDate = endDate || startDate;
      const rehearsalDays = Math.ceil((new Date(finalEndDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      console.log("Adding new tour date:", { startDate, finalEndDate, location, tourId, tourDateType, isTourPackOnly });
      
      let locationId: string | null = null;
      if (newLocationDetails && newLocationDetails.name) {
        locationId = await getOrCreateLocationWithDetails(newLocationDetails);
      } else {
        locationId = await getOrCreateLocation(location);
      }
      console.log("Location ID:", locationId);
      const { data: newTourDate, error: tourDateError } = await supabase
        .from("tour_dates")
        .insert({
          tour_id: tourId,
          date: startDate, // Keep for backward compatibility
          start_date: startDate,
          end_date: finalEndDate,
          tour_date_type: tourDateType,
          rehearsal_days: rehearsalDays,
          location_id: locationId,
          is_tour_pack_only: isTourPackOnly,
        })
        .select(`
          id,
          date,
          start_date,
          end_date,
          tour_date_type,
          rehearsal_days,
          is_tour_pack_only,
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

      console.log("Creating job for tour date:", newTourDate.id);
      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          title: tourDateType === 'rehearsal' 
            ? `${tourData.name} - Rehearsal (${location})` 
            : tourDateType === 'travel'
            ? `${tourData.name} - Travel (${location})`
            : `${tourData.name} (${location || 'No Location'})`,
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
        console.error("FAILED at job creation:", jobError);
        console.error("Job creation error details:", {
          message: jobError.message,
          code: jobError.code,
          details: jobError.details,
          hint: jobError.hint
        });
        // Clean up the orphaned tour_date
        await supabase.from("tour_dates").delete().eq("id", newTourDate.id);
        throw new Error(`Failed to create job: ${jobError.message}`);
      }
      console.log("✓ Job created successfully:", newJob.id);

      const departments =
        tourData.tour_dates?.[0]?.jobs?.[0]?.job_departments?.map(
          (dept: any) => dept.department
        ) || ["sound", "lights", "video"];
      const jobDepartments = departments.map((department) => ({
        job_id: newJob.id,
        department,
      }));
      
      console.log("Creating job departments:", jobDepartments);
      const { error: deptError } = await supabase
        .from("job_departments")
        .insert(jobDepartments);
      
      if (deptError) {
        console.error("FAILED at job departments creation:", deptError);
        console.error("Job departments error details:", {
          message: deptError.message,
          code: deptError.code,
          details: deptError.details
        });
        // Clean up job and tour_date
        await supabase.from("jobs").delete().eq("id", newJob.id);
        await supabase.from("tour_dates").delete().eq("id", newTourDate.id);
        throw new Error(`Failed to create job departments: ${deptError.message}`);
      }
      console.log("✓ Job departments created successfully");

      // Create job date types for each day in the date range
      const jobDateTypes = [];
      const start = new Date(startDate);
      const end = new Date(finalEndDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        jobDateTypes.push({
          job_id: newJob.id,
          date: d.toISOString().split('T')[0],
          type: tourDateType
        });
      }
      
      console.log("Creating job_date_types:", jobDateTypes);
      const {
        error: upsertDateTypeError,
      } = await supabase
        .from("job_date_types")
        .upsert(jobDateTypes, { onConflict: "job_id,date" });

      let dateTypeError = upsertDateTypeError;

      if (
        upsertDateTypeError?.message?.includes(
          "no unique or exclusion constraint matching the ON CONFLICT specification"
        )
      ) {
        console.warn(
          "job_date_types upsert failed due to missing constraint. Falling back to manual dedup insert."
        );

        const { data: existingDateTypes, error: existingDateTypesError } =
          await supabase
            .from("job_date_types")
            .select("date,type")
            .eq("job_id", newJob.id);

        if (existingDateTypesError) {
          dateTypeError = existingDateTypesError;
        } else {
          const existingDateTypeKeys = new Set(
            (existingDateTypes || []).map(
              (dateType) => `${dateType.date}:${dateType.type}`
            )
          );

          const newDateTypes = jobDateTypes.filter((dateType) => {
            const key = `${dateType.date}:${dateType.type}`;
            if (existingDateTypeKeys.has(key)) {
              return false;
            }
            existingDateTypeKeys.add(key);
            return true;
          });

          if (newDateTypes.length) {
            const { error: fallbackInsertError } = await supabase
              .from("job_date_types")
              .insert(newDateTypes);
            dateTypeError = fallbackInsertError;
          } else {
            dateTypeError = null;
          }
        }
      }

      if (dateTypeError) {
        console.error("FAILED at job_date_types creation:", dateTypeError);
        console.error("Job date types error details:", {
          message: dateTypeError.message,
          code: dateTypeError.code,
          details: dateTypeError.details,
          hint: dateTypeError.hint
        });
        // Clean up everything created so far
        await supabase.from("job_departments").delete().eq("job_id", newJob.id);
        await supabase.from("jobs").delete().eq("id", newJob.id);
        await supabase.from("tour_dates").delete().eq("id", newTourDate.id);
        throw new Error(`Failed to create job date types: ${dateTypeError.message}`);
      }
      console.log("✓ Job date types created successfully");

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
    newLocation: string,
    tourDateType: 'show' | 'rehearsal' | 'travel',
    startDate: string,
    endDate: string,
    isTourPackOnly: boolean
  ) => {
    try {
      if (!tourId) {
        throw new Error("Tour ID is required");
      }
      const finalEndDate = endDate || startDate;
      const rehearsalDays = Math.ceil((new Date(finalEndDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log("Editing tour date:", { dateId, startDate, finalEndDate, newLocation, tourDateType, isTourPackOnly });
      let locationId: string | null = null;
      if (editLocationDetails && editLocationDetails.name) {
        locationId = await getOrCreateLocationWithDetails(editLocationDetails);
      } else {
        locationId = await getOrCreateLocation(newLocation);
      }

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
          date: startDate,
          start_date: startDate,
          end_date: finalEndDate,
          tour_date_type: tourDateType,
          rehearsal_days: rehearsalDays,
          location_id: locationId,
          is_tour_pack_only: isTourPackOnly,
        })
        .eq("id", dateId)
        .select(`
          id,
          date,
          is_tour_pack_only,
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
          void supabase.functions.invoke('push', {
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

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .update({
          title: tourDateType === 'rehearsal' 
            ? `${tourData.name} - Rehearsal (${newLocation})` 
            : tourDateType === 'travel'
            ? `${tourData.name} - Travel (${newLocation})`
            : `${tourData.name} (${newLocation || 'No Location'})`,
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

      // Update job date types for all jobs of this tour date
      if (jobs && jobs.length > 0) {
        for (const job of jobs) {
          // Delete existing job date types for this job
          await supabase
            .from("job_date_types")
            .delete()
            .eq("job_id", job.id);

          // Create new job date types for the updated date range
          const jobDateTypes = [];
          const start = new Date(startDate);
          const end = new Date(finalEndDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            jobDateTypes.push({
              job_id: job.id,
              date: d.toISOString().split('T')[0],
              type: tourDateType
            });
          }
          
          if (jobDateTypes.length > 0) {
            const { error: dateTypeError } = await supabase
              .from("job_date_types")
              .insert(jobDateTypes);
            if (dateTypeError) {
              console.error("Error updating job date types:", dateTypeError);
            }
          }
        }
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
    // ... keep existing code (deletion logic remains the same)
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
          // Use service to delete job date types
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
    const baseDate = (dateObj.start_date || dateObj.date || '').split('T')[0] || '';
    setEditStartDate(baseDate);
    setEditEndDate((dateObj.end_date || baseDate || '').split('T')[0] || '');
    setEditLocationValue(dateObj.location?.name || "");
    setEditTourDateType(dateObj.tour_date_type || 'show');
    setEditTourPackOnly(dateObj.is_tour_pack_only || false);

    if (dateObj.location) {
      setEditLocationDetails({
        name: dateObj.location.name,
        address: dateObj.location.formatted_address || dateObj.location.address || '',
        coordinates:
          dateObj.location.latitude && dateObj.location.longitude
            ? { lat: dateObj.location.latitude, lng: dateObj.location.longitude }
            : undefined,
        place_id: dateObj.location.google_place_id || dateObj.location.place_id || undefined,
      });
    } else {
      setEditLocationDetails(null);
    }
  };

  const cancelEditing = () => {
    setEditingTourDate(null);
    setEditLocationValue("");
    setEditTourDateType('show');
    setEditStartDate("");
    setEditEndDate("");
    setEditTourPackOnly(false);
    setEditLocationDetails(null);
  };

  const submitEditing = async (dateId: string) => {
    await handleEditDate(
      dateId, 
      editLocationValue, 
      editTourDateType,
      editStartDate,
      editEndDate,
      editTourPackOnly
    );
    cancelEditing();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] md:w-full max-h-[95vh] md:max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-4 border-b">
          <DialogTitle className="text-base md:text-lg">
            {readOnly ? 'Tour Dates' : 'Manage Tour Dates'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto px-4 md:px-6">
          <div className="space-y-3 md:space-y-4 py-4 pb-6">
            {/* Bulk folders button removed; availability moved to Team Assignments */}
            
            <div className="space-y-4">
              {tourDates?.map((dateObj) => {
                const foldersExist = foldersExistenceMap?.[dateObj.id] || false;
                const isDeleting = isDeletingDate === dateObj.id;
                const isCreatingFoldersForDate = createdTourDateIds.includes(dateObj.id);

                return (
                  <div key={dateObj.id} className="p-3 md:p-4 border rounded-lg">
                    {editingTourDate && editingTourDate.id === dateObj.id && !readOnly ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <Input
                            type="date"
                            value={editStartDate}
                            onChange={(e) => {
                              const newDate = e.target.value;
                              setEditStartDate(newDate);
                              if (editTourDateType !== 'rehearsal') {
                                setEditEndDate(newDate);
                              }
                            }}
                            required
                            className="text-sm"
                          />
                        </div>
                        {editTourDateType === 'rehearsal' && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <Input
                              type="date"
                              value={editEndDate}
                              min={editStartDate}
                              onChange={(e) => setEditEndDate(e.target.value)}
                              required
                              className="text-sm"
                            />
                          </div>
                        )}
                        <PlaceAutocomplete
                          value={editLocationValue}
                          onInputChange={(value) => {
                            setEditLocationValue(value);
                            setEditLocationDetails(null);
                          }}
                          onSelect={(result) => {
                            setEditLocationValue(result.name);
                            setEditLocationDetails({
                              name: result.name,
                              address: result.address,
                              coordinates: result.coordinates,
                              place_id: result.place_id,
                            });
                          }}
                          placeholder="Location"
                          label="Location"
                          className="w-full"
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="tour-pack-only-edit"
                            checked={editTourPackOnly}
                            onCheckedChange={(checked) => setEditTourPackOnly(checked as boolean)}
                          />
                          <Label htmlFor="tour-pack-only-edit" className="text-xs md:text-sm">
                            Tour Pack Only (skip PA pullsheet)
                          </Label>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2">
                          <Button variant="outline" onClick={cancelEditing} className="w-full sm:w-auto">
                            Cancel
                          </Button>
                          <Button onClick={() => submitEditing(dateObj.id)} className="w-full sm:w-auto">
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span>{format(new Date(dateObj.date), "MMM d, yyyy")}</span>
                            {dateObj.is_tour_pack_only && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                <Package className="h-3 w-3" />
                                <span className="hidden sm:inline">Tour Pack Only</span>
                                <span className="sm:hidden">TP Only</span>
                              </div>
                            )}
                          </div>
                          {dateObj.location?.name && (
                            <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{dateObj.location.name}</span>
                            </div>
                          )}
                          {foldersExist && (
                            <div className="text-xs text-green-600">
                              ✓ Flex folders created
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 md:gap-2 self-end sm:self-auto">
                          {!readOnly && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCreateFoldersForDate(dateObj)}
                                title="Create Flex folders"
                                disabled={foldersExist || isCreatingFoldersForDate}
                                className={`h-9 w-9 touch-manipulation ${foldersExist ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                {isCreatingFoldersForDate ? (
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
                                className="h-9 w-9 touch-manipulation"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDate(dateObj.id)}
                                title="Delete Date"
                                disabled={isDeleting}
                                className={`h-9 w-9 touch-manipulation ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
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
              <div className="space-y-3 md:space-y-4 border-t pt-4">
                <h3 className="text-base md:text-lg font-semibold">Add New Date</h3>
                <TourDateFormFields
                  location={newLocation}
                  setLocation={setNewLocation}
                  setLocationDetails={setNewLocationDetails}
                  tourDateType={newTourDateType}
                  setTourDateType={setNewTourDateType}
                  startDate={newStartDate}
                  setStartDate={setNewStartDate}
                  endDate={newEndDate}
                  setEndDate={setNewEndDate}
                />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tour-pack-only"
                    checked={newTourPackOnly}
                    onCheckedChange={(checked) => setNewTourPackOnly(checked as boolean)}
                  />
                  <Label htmlFor="tour-pack-only" className="text-xs md:text-sm">
                    Tour Pack Only (skip PA pullsheet)
                  </Label>
                </div>
                <Button 
                  onClick={() => {
                    if (!newStartDate || !newLocation) {
                      toast({
                        title: "Error",
                        description: "Please fill in all required fields",
                        variant: "destructive",
                      });
                      return;
                    }
                    handleAddDate(
                      newLocation,
                      newTourDateType,
                      newStartDate,
                      newEndDate || newStartDate,
                      newTourPackOnly
                    );
                    // Reset form
                    setNewLocation("");
                    setNewLocationDetails(null);
                    setNewTourDateType('show');
                    setNewStartDate("");
                    setNewEndDate("");
                    setNewTourPackOnly(false);
                  }}
                  className="w-full touch-manipulation"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">
                    Add {newTourDateType === 'rehearsal' ? 'Rehearsal Period' : 
                          newTourDateType === 'travel' ? 'Travel Day' : 'Show Date'}
                  </span>
                  <span className="sm:hidden">
                    Add {newTourDateType === 'rehearsal' ? 'Rehearsal' : 
                          newTourDateType === 'travel' ? 'Travel' : 'Show'}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>
  );
};
