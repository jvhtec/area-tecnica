import { supabase } from "@/lib/supabase";

export const createAllFoldersForJob = async (
  job: any,
  formattedStartDate: string,
  formattedEndDate: string,
  documentNumber: string
) => {
  try {
    console.log("Creating Flex folders for job:", job.id);
    
    // Create main folder
    const { data: mainFolder, error: mainFolderError } = await supabase
      .from("flex_folders")
      .insert({
        job_id: job.id,
        element_id: "e281e71c-2c42-49cd-9834-0eb68135e9ac",
        folder_type: "main"
      })
      .select()
      .single();

    if (mainFolderError) throw mainFolderError;

    // Create department folders
    const departments = ["sound", "lights", "video", "production", "personnel"];
    
    for (const dept of departments) {
      const { error: deptFolderError } = await supabase
        .from("flex_folders")
        .insert({
          job_id: job.id,
          parent_id: mainFolder.id,
          element_id: dept === "sound" ? "cdd5e372-d124-11e1-bba1-00e08175e43e" :
                     dept === "lights" ? "d5af7892-d124-11e1-bba1-00e08175e43e" :
                     dept === "video" ? "a89d124d-7a95-4384-943e-49f5c0f46b23" :
                     dept === "production" ? "890811c3-fe3f-45d7-af6b-7ca4a807e84d" :
                     "b972d682-598d-4802-a390-82e28dc4480e",
          department: dept,
          folder_type: "department"
        });

      if (deptFolderError) throw deptFolderError;
    }

    console.log("Successfully created Flex folders for job:", job.id);
    return true;
  } catch (error) {
    console.error("Error creating Flex folders:", error);
    throw error;
  }
};