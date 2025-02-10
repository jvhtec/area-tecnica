import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Department } from "@/types/department";
import createFolderIcon from "@/assets/icons/icon.png";
import { useNavigate } from "react-router-dom";

// UI Components & Icons
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Wrench, Star, Moon, Mic } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  MapPin,
  Users,
  Edit,
  Trash2,
  Upload,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye
} from "lucide-react";

// Dialogs
import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { useTimezone } from "@/contexts/TimezoneContext";

export interface JobDocument {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

export interface JobCardNewProps {
  job: any;
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  showAssignments?: boolean;
  department?: Department;
  userRole?: string | null;
  onDeleteDocument?: (jobId: string, document: JobDocument) => void;
  showUpload?: boolean;
  showManageArtists?: boolean;
  isProjectManagementPage?: boolean;
}

const FLEX_FOLDER_IDS = {
  mainFolder: "e281e71c-2c42-49cd-9834-0eb68135e9ac",
  subFolder: "358f312c-b051-11df-b8d5-00e08175e43e",
  location: "2f49c62c-b139-11df-b8d5-00e08175e43e",
  mainResponsible: "4bc2df20-e700-11ea-97d0-2a0a4490a7fb",
  documentacionTecnica: "3787806c-af2d-11df-b8d5-00e08175e43e",
  presupuestosRecibidos: "3787806c-af2d-11df-b8d5-00e08175e43e",
  hojaGastos: "566d32e0-1a1e-11e0-a472-00e08175e43e",
  crewCall: "253878cc-af31-11df-b8d5-00e08175e43e",
  pullSheet: "a220432c-af33-11df-b8d5-00e08175e43e"
};

const DRYHIRE_PARENT_IDS = {
  sound: {
    "01": "43b1f259-420e-4d12-b76d-1675ce6ddbfd",
    "02": "6d21b607-7c3a-43fe-bdb4-75a77a8ac4fa",
    "03": "b8f1c60a-8fa2-44a5-ac83-40012e73f639",
    "04": "68d9ff6c-8313-4ff9-844e-47873d958b9b",
    "05": "a19204e0-4b8c-4f2d-a86b-a07fa189f44c",
    "06": "27229f82-d759-4f7d-800a-1793e8c2b514",
    "07": "73b16d86-db32-4b91-bbe2-f11149db4aa5",
    "08": "8cdb98c5-8c32-4a14-bb3f-8a108cebb283",
    "09": "650960c8-3000-4e4a-8113-ec1cc5acb1c9",
    "10": "40ac2c72-3dbd-4804-998f-e42a6dd7dd33",
    "11": "edaae406-25c2-4154-80ac-662bff9921c2",
    "12": "bc758718-24c8-4045-bc65-6039b46fae0c"
  },
  lights: {
    "01": "967f1612-fb01-4608-ad1d-0dc002ae9f8b",
    "02": "0c42a6b2-03dc-40fe-b30f-6d406329e8b0",
    "03": "9dc0d60b-6d0b-4fc7-be1a-85989d7df6d0",
    "04": "af64eafc-f8e8-442c-84e1-9088f2a939eb",
    "05": "801ee08a-a868-42e1-8cf3-d34d33d881a5",
    "06": "de57a801-7e5a-4831-afdb-0816522082a2",
    "07": "0e8e9cf1-9ec2-4522-a46e-d3f60bc7816a",
    "08": "86cc8f06-6286-4825-bfb8-cfc3cd614c82",
    "09": "4f0297a6-89cd-4654-b8c5-14c20cb9bc44",
    "10": "73a98ac6-6c11-4680-a854-186cc3d6901e",
    "11": "43b1f259-420e-4d12-b76d-1675ce6ddbfd",
    "12": "faa70677-f8de-4161-8b2e-8846caa07ada"
  }
};

const DEPARTMENT_IDS = {
  sound: "cdd5e372-d124-11e1-bba1-00e08175e43e",
  lights: "d5af7892-d124-11e1-bba1-00e08175e43e",
  video: "a89d124d-7a95-4384-943e-49f5c0f46b23",
  production: "890811c3-fe3f-45d7-af6b-7ca4a807e84d",
  personnel: "b972d682-598d-4802-a390-82e28dc4480e"
};

const RESPONSIBLE_PERSON_IDS = {
  sound: "4b0d98e0-e700-11ea-97d0-2a0a4490a7fb",
  lights: "4b559e60-e700-11ea-97d0-2a0a4490a7fb",
  video: "bb9690ac-f22e-4bc4-94a2-6d341ca0138d",
  production: "4ce97ce3-5159-401a-9cf8-542d3e479ade",
  personnel: "4b618540-e700-11ea-97d0-2a0a4490a7fb"
};

const DEPARTMENT_SUFFIXES = {
  sound: "S",
  lights: "L",
  video: "V",
  production: "P",
  personnel: "HR"
};

async function createFlexFolder(payload: Record<string, any>) {
  console.log("Creating Flex folder with payload:", payload);
  const response = await fetch("https://sectorpro.flexrentalsolutions.com/f5/api/element", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": "82b5m0OKgethSzL1YbrWMUFvxdNkNMjRf82E"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Flex folder creation error:", errorData);
    throw new Error(errorData.exceptionMessage || "Failed to create folder in Flex");
  }

  const data = await response.json();
  console.log("Created Flex folder:", data);
  return data;
}

async function createAllFoldersForJob(
  job: any,
  formattedStartDate: string,
  formattedEndDate: string,
  documentNumber: string
) {
  if (job.job_type === "dryhire") {
    console.log("Dryhire job type detected. Creating dryhire folder...");

    const department = job.job_departments[0]?.department;
    if (!department || !["sound", "lights"].includes(department)) {
      throw new Error("Invalid department for dryhire job");
    }

    const startDate = new Date(job.start_time);
    const monthKey = startDate.toISOString().slice(5, 7);
    const parentFolderId = DRYHIRE_PARENT_IDS[department][monthKey];

    if (!parentFolderId) {
      throw new Error(`No parent folder found for month ${monthKey}`);
    }

    const dryHireFolderPayload = {
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId: parentFolderId,
      open: true,
      locked: false,
      name: `Dry Hire - ${job.title}`,
      plannedStartDate: formattedStartDate,
      plannedEndDate: formattedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS[department],
      documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[department]}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
    };

    console.log("Creating dryhire folder with payload:", dryHireFolderPayload);
    const dryHireFolder = await createFlexFolder(dryHireFolderPayload);

    await supabase
      .from("flex_folders")
      .insert({
        job_id: job.id,
        parent_id: parentFolderId,
        element_id: dryHireFolder.elementId,
        department: department,
        folder_type: "dryhire",
      });

    return;
  }

  if (job.job_type === "tourdate") {
    console.log("Tourdate job type detected. Validating tour data...");

    if (!job.tour_id) {
      throw new Error("Tour ID is missing for tourdate job");
    }

    const { data: tourData, error: tourError } = await supabase
      .from("tours")
      .select(`
        id,
        name,
        flex_main_folder_id,
        flex_sound_folder_id,
        flex_lights_folder_id,
        flex_video_folder_id,
        flex_production_folder_id,
        flex_personnel_folder_id
      `)
      .eq("id", job.tour_id)
      .single();

    if (tourError || !tourData) {
      console.error("Error fetching tour data:", tourError);
      throw new Error(`Tour not found for tour_id: ${job.tour_id}`);
    }

    if (!tourData.flex_main_folder_id) {
      throw new Error("Tour folders have not been created yet. Please create tour folders first.");
    }

    console.log("Using tour folders:", tourData);

    const departments = ["sound", "lights", "video", "production", "personnel"];
    const locationName = job.location?.name || "No Location";
    const formattedDate = format(new Date(job.start_time), "MMM d, yyyy");

    for (const dept of departments) {
      const parentFolderId = tourData[`flex_${dept}_folder_id`];
      if (!parentFolderId) {
        console.warn(`No parent folder ID found for ${dept} department`);
        continue;
      }

      const { data: [parentRow], error: parentErr } = await supabase
        .from("flex_folders")
        .select("*")
        .eq("element_id", parentFolderId)
        .limit(1);

      if (parentErr) {
        console.error("Error fetching parent row:", parentErr);
        continue;
      }
      if (!parentRow) {
        console.warn(`No local DB row found for parent element_id=${parentFolderId}`);
        continue;
      }

      const tourDateFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: parentFolderId,
        open: true,
        locked: false,
        name: `${locationName} - ${formattedDate} - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
      };

      console.log(`Creating tour date folder for ${dept}:`, tourDateFolderPayload);
      const tourDateFolder = await createFlexFolder(tourDateFolderPayload);

      const { data: [childRow], error: childErr } = await supabase
        .from("flex_folders")
        .insert({
          job_id: job.id,
          parent_id: parentRow.id,
          element_id: tourDateFolder.elementId,
          department: dept,
          folder_type: "tourdate",
        })
        .select("*");

      if (childErr) {
        console.error("Error inserting child folder row:", childErr);
        continue;
      }

      if (dept !== "personnel") {
        const subfolders = [
          {
            definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
            name: `Documentación Técnica - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
            suffix: "DT",
          },
          {
            definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
            name: `Presupuestos Recibidos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
            suffix: "PR",
          },
          {
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
            name: `Hoja de Gastos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
            suffix: "HG",
          },
        ];

        for (const sf of subfolders) {
          const subPayload = {
            definitionId: sf.definitionId,
            parentElementId: childRow.element_id,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            departmentId: DEPARTMENT_IDS[dept],
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${sf.suffix}`,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
          };

          await createFlexFolder(subPayload);
        }
      }
      if (dept === "sound") {
        const soundSubfolders = [
          { name: `${job.title} - Tour Pack`, suffix: "TP" },
          { name: `${job.title} - PA`, suffix: "PA" },
        ];

        for (const sf of soundSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.pullSheet,
            parentElementId: childRow.element_id,
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
          
          await createFlexFolder(subPayload);
        }
      }
      if (dept === "personnel") {
        const personnelSubfolders = [
          { name: `Gastos de Personal - ${job.title}`, suffix: "GP" },  
        ];

        for (const sf of personnelSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.subFolder,
            parentElementId: childRow.element_id,
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

          await createFlexFolder(subPayload);
        }

        const personnelcrewCall = [
          { name: `Crew Call Sonido - ${job.title}`, suffix: "CCS" },  
          { name: `Crew Call Luces - ${job.title}`, suffix: "CCL" },
        ];

        for (const sf of personnelcrewCall) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.crewCall,
            parentElementId: childRow.element_id,
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

          await createFlexFolder(subPayload);
        }
      }
    }
    return;
  }

  console.log("Default job type detected. Creating full folder structure.");

const topPayload = {
  definitionId: FLEX_FOLDER_IDS.mainFolder,
  open: true,
  locked: false,
  name: job.title,
  plannedStartDate: formattedStartDate,
  plannedEndDate: formattedEndDate,
  locationId: FLEX_FOLDER_IDS.location,
  personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
  documentNumber,
};

const topFolder = await createFlexFolder(topPayload);
const topFolderId = topFolder.elementId;

await supabase
  .from("flex_folders")
  .insert({
    job_id: job.id,
    element_id: topFolderId,
    folder_type: "main_event",
  });

const departments = ["sound", "lights", "video", "production", "personnel"];
for (const dept of departments) {
  const deptPayload = {
    definitionId: FLEX_FOLDER_IDS.subFolder,
    parentElementId: topFolderId,
    open: true,
    locked: false,
    name: `${job.title} - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
    plannedStartDate: formattedStartDate,
    plannedEndDate: formattedEndDate,
    locationId: FLEX_FOLDER_IDS.location,
    departmentId: DEPARTMENT_IDS[dept],
    documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}`,
    personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
  };

  console.log(`Creating department folder for ${dept}:`, deptPayload);
  const deptFolder = await createFlexFolder(deptPayload);

  // IMPORTANT: capture the inserted row so we get its internal (local DB) ID,
  // similar to what we do in the tourdate branch.
  const { data: [childRow], error: childErr } = await supabase
    .from("flex_folders")
    .insert({
      job_id: job.id,
      parent_id: topFolderId,
      element_id: deptFolder.elementId,
      department: dept,
      folder_type: "department",
    })
    .select("*");

  if (childErr || !childRow) {
    console.error("Error inserting department folder row:", childErr);
    continue;
  }

  const deptFolderId = childRow.element_id;

  if (dept !== "personnel") {
    const subfolders = [
      {
        definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
        name: `Documentación Técnica - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
        suffix: "DT",
      },
      {
        definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
        name: `Presupuestos Recibidos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
        suffix: "PR",
      },
      {
        definitionId: FLEX_FOLDER_IDS.hojaGastos,
        name: `Hoja de Gastos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
        suffix: "HG",
      },
    ];

    for (const sf of subfolders) {
      const subPayload = {
        definitionId: sf.definitionId,
        parentElementId: deptFolderId,
        open: true,
        locked: false,
        name: sf.name,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${sf.suffix}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
      };

      await createFlexFolder(subPayload);
    }
  } else if (dept === "personnel") {
    const personnelSubfolders = [
      { name: `Crew Call Sonido - ${job.title}`, suffix: "CCS" },
      { name: `Crew Call Luces - ${job.title}`, suffix: "CCL" },
      { name: `Gastos de Personal - ${job.title}`, suffix: "GP" },
    ];

    for (const sf of personnelSubfolders) {
      const subPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: deptFolderId,
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

      await createFlexFolder(subPayload);
    }
  }
}
}

export function JobCardNew({
  job,
  onEditClick,
  onDeleteClick,
  onJobClick,
  department = "sound",
  userRole,
  onDeleteDocument,
  showUpload = false,
  showManageArtists = false,
  isProjectManagementPage = false
}: JobCardNewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === "dark";
  const { formatDate, convertToLocal } = useTimezone();

  const borderColor = job.color ? job.color : "#7E69AB";
  const appliedBorderColor = isDark ? (job.darkColor ? job.darkColor : borderColor) : borderColor;
  const bgColor = job.color ? `${job.color}05` : "#7E69AB05";
  const appliedBgColor = isDark ? (job.darkColor ? `${job.darkColor}15` : bgColor) : bgColor;

  const [collapsed, setCollapsed] = useState(true);
  const [assignments, setAssignments] = useState(job.job_assignments || []);
  const [documents, setDocuments] = useState<JobDocument[]>(job.job_documents || []);
  const [dateTypes, setDateTypes] = useState<Record<string, any>>({});
  const [soundTaskDialogOpen, setSoundTaskDialogOpen] = useState(false);
  const [lightsTaskDialogOpen, setLightsTaskDialogOpen] = useState(false);
  const [videoTaskDialogOpen, setVideoTaskDialogOpen] = useState(false);
  const [editJobDialogOpen, setEditJobDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);

  const getDateTypeIcon = (jobId: string, date: Date, dateTypes: Record<string, any>) => {
    const key = `${jobId}-${format(date, "yyyy-MM-dd")}`;
    const dateType = dateTypes[key]?.type;
    switch (dateType) {
      case "travel":
        return <Plane className="h-3 w-3 text-blue-500" />;
      case "setup":
        return <Wrench className="h-3 w-3 text-yellow-500" />;
      case "show":
        return <Star className="h-3 w-3 text-green-500" />;
      case "off":
        return <Moon className="h-3 w-3 text-gray-500" />;
      case "rehearsal":
        return <Mic className="h-3 w-3 text-violet-500" />;
      default:
        return null;
    }
  };

  useEffect(() => {
    async function fetchDateTypes() {
      const { data, error } = await supabase
        .from("job_date_types")
        .select("*")
        .eq("job_id", job.id);
      if (!error && data && data.length > 0) {
        const key = `${job.id}-${format(new Date(job.start_time), "yyyy-MM-dd")}`;
        setDateTypes({ [key]: data[0] });
      }
    }
    fetchDateTypes();
  }, [job.id, job.start_time]);

  const assignedTechnicians = job.job_type !== "dryhire"
    ? assignments
        .map((assignment: any) => {
          let role = null;
          switch (department) {
            case "sound":
              role = assignment.sound_role;
              break;
            case "lights":
              role = assignment.lights_role;
              break;
            case "video":
              role = assignment.video_role;
              break;
            default:
              role = assignment.sound_role || assignment.lights_role || assignment.video_role;
          }
          if (!role) return null;
          return {
            id: assignment.technician_id,
            name: `${assignment.profiles?.first_name || ""} ${assignment.profiles?.last_name || ""}`.trim(),
            role
          };
        })
        .filter(Boolean)
    : [];

  const { data: soundTasks } = useQuery({
    queryKey: ["sound-tasks", job.id],
    queryFn: async () => {
      if (department !== "sound") return null;
      const { data, error } = await supabase
        .from("sound_job_tasks")
        .select(
          `
            *,
            assigned_to (
              first_name,
              last_name
            ),
            task_documents(*)
          `
        )
        .eq("job_id", job.id);
      if (error) throw error;
      return data;
    },
    enabled: department === "sound",
    retry: 3,
    retryDelay: 1000
  });

  const { data: personnel } = useQuery({
    queryKey: ["sound-personnel", job.id],
    queryFn: async () => {
      if (department !== "sound") return null;
      const { data: existingData, error: fetchError } = await supabase
        .from("sound_job_personnel")
        .select("*")
        .eq("job_id", job.id)
        .maybeSingle();
      if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
      if (!existingData) {
        const { data: newData, error: insertError } = await supabase
          .from("sound_job_personnel")
          .insert({
            job_id: job.id,
            foh_engineers: 0,
            mon_engineers: 0,
            pa_techs: 0,
            rf_techs: 0
          })
          .select()
          .single();
        if (insertError) throw insertError;
        return newData;
      }
      return existingData;
    },
    enabled: department === "sound"
  });

  const updateFolderStatus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("jobs")
        .update({ flex_folders_created: true })
        .eq("id", job.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  });

  const createFlexFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (job.flex_folders_created) {
      toast({
        title: "Folders already created",
        description: "Flex folders have already been created for this job.",
        variant: "destructive"
      });
      return;
    }

    try {
      const startDate = new Date(job.start_time);
      const documentNumber = startDate
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");

      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);
      await updateFolderStatus.mutateAsync();

      toast({
        title: "Success",
        description: "Flex folders have been created successfully."
      });
    } catch (error: any) {
      console.error("Error creating Flex folders:", error);
      toast({
        title: "Error creating folders",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const calculateTotalProgress = () => {
    if (!soundTasks?.length) return 0;
    const totalProgress = soundTasks.reduce((acc, task) => acc + (task.progress || 0), 0);
    return Math.round(totalProgress / soundTasks.length);
  };

  const getCompletedTasks = () => {
    if (!soundTasks?.length) return 0;
    return soundTasks.filter((task: any) => task.status === "completed").length;
  };

  const getTotalPersonnel = () => {
    if (!personnel) return 0;
    return (
      (personnel.foh_engineers || 0) +
      (personnel.mon_engineers || 0)
      + (personnel.pa_techs || 0)
      + (personnel.rf_techs || 0)
    );
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick(job);
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!["admin", "management"].includes(userRole || "")) {
      toast({
        title: "Permission denied",
        description: "Only management users can delete jobs",
        variant: "destructive"
      });
      return;
    }

    onDeleteClick(job.id);
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-l-4 transition-all",
        collapsed ? "hover:bg-muted/50" : "bg-muted/50"
      )}
      style={{
        borderLeftColor: appliedBorderColor,
        backgroundColor: appliedBgColor
      }}
      onClick={() => onJobClick(job.id)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{job.title}</h3>
              {job.job_type === "tourdate" && (
                <Badge variant="outline" className="capitalize">
                  {job.job_type}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDate(new Date(job.start_time))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!job.flex_folders_created && (
              <Button
                variant="outline"
                size="icon"
                onClick={createFlexFoldersHandler}
                title="Create Flex Folders"
              >
                <img src={createFolderIcon} alt="Create Flex Folders" className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEditClick}
              className="hover:bg-transparent"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              className="hover:bg-transparent"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed(!collapsed);
              }}
              className="hover:bg-transparent"
            >
              {collapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
