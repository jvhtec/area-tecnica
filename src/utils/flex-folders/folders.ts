
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FlexFolderType } from "@/types/flex";
import { createFlexFolder } from "./api";
import { 
  FLEX_FOLDER_IDS, 
  DRYHIRE_PARENT_IDS, 
  DEPARTMENT_IDS, 
  RESPONSIBLE_PERSON_IDS, 
  DEPARTMENT_SUFFIXES 
} from "./constants";

interface FolderCreationResult {
  success: boolean;
  folderId?: string;
  error?: string;
}

// Helper function to format dates for Flex API (expects ISO 8601 with timezone)
const formatDateForFlex = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toISOString(); // This returns YYYY-MM-DDTHH:mm:ss.sssZ format
};

export const createFlexFolderWithType = async (
  jobId: string,
  folderName: string,
  folderType: FlexFolderType,
  department?: string,
  job?: any,
  formattedStartDate?: string,
  formattedEndDate?: string,
  documentNumber?: string
): Promise<FolderCreationResult> => {
  try {
    console.log("Creating Flex folder with sophisticated logic:", {
      folderName,
      folderType,
      department,
      jobType: job?.job_type,
      startDate: formattedStartDate,
      endDate: formattedEndDate
    });

    let payload: any = {
      name: folderName,
      open: true,
      locked: false
    };

    // Configure payload based on folder type and job details
    if (folderType === 'job') {
      // Main job folder
      payload.definitionId = FLEX_FOLDER_IDS.mainFolder;
      payload.parentElementId = FLEX_FOLDER_IDS.mainFolder;
      
      if (job) {
        // Use proper date formatting for Flex API
        if (formattedStartDate) {
          payload.plannedStartDate = formatDateForFlex(formattedStartDate + 'T09:00:00');
        }
        if (formattedEndDate) {
          payload.plannedEndDate = formatDateForFlex(formattedEndDate + 'T18:00:00');
        }
        if (job.location_id) payload.locationId = job.location_id;
        if (documentNumber) payload.documentNumber = documentNumber;
        
        // Set responsible person based on job type or default
        if (job.job_type === 'dryhire' && department) {
          payload.personResponsibleId = RESPONSIBLE_PERSON_IDS[department as keyof typeof RESPONSIBLE_PERSON_IDS] || RESPONSIBLE_PERSON_IDS.comercial;
        } else {
          payload.personResponsibleId = RESPONSIBLE_PERSON_IDS.mainResponsible;
        }
      }
      
    } else if (folderType === 'department') {
      // Department subfolder
      payload.definitionId = FLEX_FOLDER_IDS.subFolder;
      
      if (department) {
        payload.departmentId = DEPARTMENT_IDS[department as keyof typeof DEPARTMENT_IDS];
        payload.personResponsibleId = RESPONSIBLE_PERSON_IDS[department as keyof typeof RESPONSIBLE_PERSON_IDS];
        
        // For dryhire jobs, use date-dependent parent folders
        if (job?.job_type === 'dryhire' && formattedStartDate) {
          const month = formattedStartDate.substring(5, 7); // Extract MM from YYYY-MM-DD
          const dryhireParents = DRYHIRE_PARENT_IDS[department as keyof typeof DRYHIRE_PARENT_IDS];
          if (dryhireParents && dryhireParents[month as keyof typeof dryhireParents]) {
            payload.parentElementId = dryhireParents[month as keyof typeof dryhireParents];
          }
        }
      }
      
    } else if (folderType === 'crew_call') {
      // Crew call folder
      payload.definitionId = FLEX_FOLDER_IDS.crewCall;
      
      if (department) {
        payload.departmentId = DEPARTMENT_IDS[department as keyof typeof DEPARTMENT_IDS];
        payload.personResponsibleId = RESPONSIBLE_PERSON_IDS[department as keyof typeof RESPONSIBLE_PERSON_IDS];
      }
      
      if (job && formattedStartDate) {
        payload.plannedStartDate = formatDateForFlex(formattedStartDate + 'T09:00:00');
        if (formattedEndDate) {
          payload.plannedEndDate = formatDateForFlex(formattedEndDate + 'T18:00:00');
        }
        if (job.location_id) payload.locationId = job.location_id;
        
        // Document number with department suffix
        if (documentNumber && department) {
          const suffix = DEPARTMENT_SUFFIXES[department as keyof typeof DEPARTMENT_SUFFIXES] || '';
          payload.documentNumber = `${documentNumber}${suffix}`;
        }
      }
    }

    console.log("Final payload for Flex folder creation:", payload);

    // Use the secure edge function with proper payload
    const folderResponse = await createFlexFolder(payload);
    const folderId = folderResponse.elementId;

    console.log("Flex folder created successfully:", { folderId, folderName });

    // Store the folder ID in the database
    const { error: dbError } = await supabase
      .from("flex_folders")
      .insert({
        job_id: jobId,
        element_id: folderId,
        folder_type: folderType,
        department: department,
      });

    if (dbError) {
      console.error("Error storing Flex folder ID:", dbError);
      toast.error("Error linking Flex folder to job.");
      return { success: false, error: "Database error" };
    }

    toast.success(`Flex folder "${folderName}" created successfully!`);
    return { success: true, folderId: folderId };
  } catch (error: any) {
    console.error("Error creating Flex folder:", error);
    toast.error(`Failed to create Flex folder: ${error.message}`);
    return { success: false, error: error.message };
  }
};

export const createJobFolders = async (jobId: string, jobTitle: string): Promise<void> => {
  // Get job details for proper folder configuration
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    console.error("Error fetching job details:", jobError);
    toast.error("Error fetching job details for folder creation.");
    return;
  }

  const startDate = new Date(job.start_time);
  const endDate = new Date(job.end_time);
  const formattedStartDate = startDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const formattedEndDate = endDate.toISOString().slice(0, 10);
  const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD

  const folderName = `${jobTitle} - ${startDate.toLocaleDateString()}`;

  // Create main job folder with sophisticated logic
  const jobFolderResult = await createFlexFolderWithType(
    jobId, 
    folderName, 
    'job',
    undefined,
    job,
    formattedStartDate,
    formattedEndDate,
    documentNumber
  );

  if (!jobFolderResult.success) {
    console.error("Failed to create job folder:", jobFolderResult.error);
    return;
  }

  // Create department subfolders with proper configuration
  const subfolders = ["sound", "lights", "video", "stage", "general"];
  for (const subfolder of subfolders) {
    const subfolderName = `${folderName} ${subfolder.charAt(0).toUpperCase() + subfolder.slice(1)}`;
    const subfolderResult = await createFlexFolderWithType(
      jobId, 
      subfolderName, 
      'department', 
      subfolder,
      job,
      formattedStartDate,
      formattedEndDate,
      documentNumber
    );

    if (!subfolderResult.success) {
      console.error(`Failed to create ${subfolder} folder:`, subfolderResult.error);
    }
  }

  // Update job record to indicate folders were created
  const { error: updateError } = await supabase
    .from('jobs')
    .update({ flex_folders_created: true })
    .eq('id', jobId);

  if (updateError) {
    console.error("Error updating job record:", updateError);
  }
};

export const createJobCrewCalls = async (jobId: string, departments: string[]): Promise<void> => {
  // Get job details for proper folder configuration
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    console.error("Error fetching job details:", jobError);
    return;
  }

  const startDate = new Date(job.start_time);
  const endDate = new Date(job.end_time);
  const formattedStartDate = startDate.toISOString().slice(0, 10);
  const formattedEndDate = endDate.toISOString().slice(0, 10);
  const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");

  // Create crew call folders for sound and lights only
  for (const department of departments) {
    if (department === 'sound' || department === 'lights') {
      const crewCallName = `Crew Call - ${department}`;
      const crewCallResult = await createFlexFolderWithType(
        jobId, 
        crewCallName, 
        'crew_call', 
        department,
        job,
        formattedStartDate,
        formattedEndDate,
        documentNumber
      );

      if (!crewCallResult.success) {
        console.error(`Failed to create ${department} crew call folder:`, crewCallResult.error);
      }
    }
  }

  // Store crew call folders in the database
  for (const department of departments) {
    if (department === 'sound' || department === 'lights') {
      try {
        // Get the created folder for this department
        const { data: flexFolder, error: flexError } = await supabase
          .from('flex_folders')
          .select('element_id')
          .eq('job_id', jobId)
          .eq('department', department)
          .eq('folder_type', 'crew_call')
          .single();

        if (flexError || !flexFolder) {
          console.error(`Error finding Flex folder for ${department} crew call:`, flexError);
          continue;
        }

        // Store in flex_crew_calls table
        const { error: insertError } = await supabase
          .from('flex_crew_calls')
          .upsert({
            job_id: jobId,
            department: department,
            flex_element_id: flexFolder.element_id
          }, {
            onConflict: 'job_id,department'
          });

        if (insertError) {
          console.error(`Error storing ${department} crew call:`, insertError);
        } else {
          console.log(`Successfully stored ${department} crew call for job ${jobId}`);
        }
      } catch (error) {
        console.error(`Error processing ${department} crew call:`, error);
      }
    }
  }
};

export const createAllFoldersForJob = async (
  job: any, 
  formattedStartDate: string, 
  formattedEndDate: string, 
  documentNumber: string
): Promise<void> => {
  try {
    // Create job folders with sophisticated logic
    await createJobFolders(job.id, job.title);
    
    // Create crew call folders for departments in the job
    const departments = job.job_departments?.map((dept: any) => dept.department) || [];
    await createJobCrewCalls(job.id, departments);
    
    console.log(`All folders created for job ${job.id} with sophisticated configuration`);
  } catch (error) {
    console.error(`Error creating all folders for job ${job.id}:`, error);
    throw error;
  }
};
