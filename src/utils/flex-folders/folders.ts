import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FlexFolderType } from "@/types/flex";

interface FolderCreationResult {
  success: boolean;
  folderId?: string;
  error?: string;
}

export const createFlexFolder = async (
  jobId: string,
  folderName: string,
  folderType: FlexFolderType,
  department?: string
): Promise<FolderCreationResult> => {
  try {
    const flexApiUrl = import.meta.env.VITE_FLEX_API_URL;
    const flexAuthToken = import.meta.env.VITE_FLEX_AUTH_TOKEN;

    if (!flexApiUrl || !flexAuthToken) {
      console.error("Flex API URL or Auth Token not configured");
      toast.error("Flex integration not properly configured.");
      return { success: false, error: "Flex configuration missing" };
    }

    const createFolderUrl = `${flexApiUrl}/folder/create`;

    const payload = {
      name: folderName,
      parent_id: import.meta.env.VITE_FLEX_PARENT_FOLDER_ID,
    };

    const response = await fetch(createFolderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": flexAuthToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Flex folder creation failed:", errorData);
      toast.error(`Flex folder creation failed: ${errorData.message || response.statusText}`);
      return { success: false, error: `Flex API Error: ${response.statusText}` };
    }

    const result = await response.json();
    const folderId = result.id;

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
  const folderName = `${jobTitle} - ${new Date().toLocaleDateString()}`;

  // Create main job folder
  const jobFolderResult = await createFlexFolder(jobId, folderName, 'job');

  if (!jobFolderResult.success) {
    console.error("Failed to create job folder:", jobFolderResult.error);
    return;
  }

  // Create subfolders
  const subfolders = ["Sound", "Lights", "Video", "Stage", "General"];
  for (const subfolder of subfolders) {
    const subfolderName = `${folderName} ${subfolder}`;
    const subfolderResult = await createFlexFolder(jobId, subfolderName, 'department', subfolder.toLowerCase());

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
  // Create crew call folders
  for (const department of departments) {
    if (department === 'sound' || department === 'lights') {
      const crewCallName = `Crew Call - ${department}`;
      const crewCallResult = await createFlexFolder(jobId, crewCallName, 'crew_call', department);

      if (!crewCallResult.success) {
        console.error(`Failed to create ${department} crew call folder:`, crewCallResult.error);
      }
    }
  }

  // After creating crew call folders, store them in our new table
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

// Add the missing createAllFoldersForJob function
export const createAllFoldersForJob = async (
  job: any, 
  formattedStartDate: string, 
  formattedEndDate: string, 
  documentNumber: string
): Promise<void> => {
  try {
    // Create job folders
    await createJobFolders(job.id, job.title);
    
    // Create crew call folders for departments in the job
    const departments = job.job_departments?.map((dept: any) => dept.department) || [];
    await createJobCrewCalls(job.id, departments);
    
    console.log(`All folders created for job ${job.id}`);
  } catch (error) {
    console.error(`Error creating all folders for job ${job.id}:`, error);
    throw error;
  }
};
