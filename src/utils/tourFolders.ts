
import { supabase } from "@/lib/supabase";
import { 
  FLEX_FOLDER_IDS, 
  DEPARTMENT_IDS, 
  RESPONSIBLE_PERSON_IDS, 
  DEPARTMENT_SUFFIXES 
} from "@/utils/flex-folders/constants";

export interface TourFolderCreationResult {
  success: boolean;
  error?: string;
  data?: any;
}

export async function createTourRootFolders(tourId: string): Promise<TourFolderCreationResult> {
  try {
    console.log("Creating tour root folders for:", tourId);
    
    const { data, error } = await supabase.functions.invoke('create-flex-folders', {
      body: {
        tourId,
        createRootFolders: true,
        createDateFolders: false
      }
    });

    if (error) {
      console.error("Error creating tour root folders:", error);
      return { success: false, error: error.message || "Failed to create tour root folders" };
    }

    console.log("Successfully created tour root folders:", data);
    return { success: true, data };
  } catch (error: any) {
    console.error("Exception creating tour root folders:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}

export async function createTourDateFolders(tourId: string): Promise<TourFolderCreationResult> {
  try {
    console.log("Creating tour date folders for:", tourId);
    
    const { data, error } = await supabase.functions.invoke('create-flex-folders', {
      body: {
        tourId,
        createRootFolders: false,
        createDateFolders: true
      }
    });

    if (error) {
      console.error("Error creating tour date folders:", error);
      return { success: false, error: error.message || "Failed to create tour date folders" };
    }

    console.log("Successfully created tour date folders:", data);
    return { success: true, data };
  } catch (error: any) {
    console.error("Exception creating tour date folders:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}

export async function createTourRootFoldersManual(tourId: string): Promise<TourFolderCreationResult> {
  try {
    console.log("Creating tour root folders manually using secure-flex-api for:", tourId);
    
    // Get tour information with tour dates
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select(`
        *,
        tour_dates (
          id,
          date,
          location_id
        )
      `)
      .eq("id", tourId)
      .single();

    if (tourError || !tour) {
      throw new Error("Tour not found");
    }

    // Get date range from tour_dates if start_date/end_date are null
    let startDate = tour.start_date;
    let endDate = tour.end_date;
    
    if (!startDate || !endDate) {
      const dates = tour.tour_dates?.map((td: any) => td.date).sort() || [];
      if (dates.length === 0) {
        throw new Error("No tour dates found");
      }
      startDate = dates[0];
      endDate = dates[dates.length - 1];
    }

    const createFlexFolder = async (payload: Record<string, any>) => {
      console.log("Creating Flex folder with payload:", payload);
      
      const { data, error } = await supabase.functions.invoke('secure-flex-api', {
        body: {
          endpoint: '/element',
          method: 'POST',
          payload
        }
      });

      if (error) {
        console.error("Secure Flex API error:", error);
        throw new Error(error.message || "Failed to create folder in Flex");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to create folder in Flex");
      }

      console.log("Created Flex folder:", data.data);
      return data.data;
    };

    const formattedStartDate = new Date(startDate).toISOString().split('.')[0] + '.000Z';
    const formattedEndDate = new Date(endDate).toISOString().split('.')[0] + '.000Z';
    const documentNumber = new Date(startDate).toISOString().slice(2, 10).replace(/-/g, '');

    const mainFolderPayload = {
      definitionId: FLEX_FOLDER_IDS.mainFolder,
      parentElementId: null,
      open: true,
      locked: false,
      name: tour.name,
      plannedStartDate: formattedStartDate,
      plannedEndDate: formattedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      notes: "Manual folder creation from Web App",
      documentNumber,
      personResponsibleId: FLEX_FOLDER_IDS.mainResponsible
    };

    console.log("Creating main folder with payload:", mainFolderPayload);
    const mainFolder = await createFlexFolder(mainFolderPayload);

    const folderUpdates: any = {
      flex_main_folder_id: mainFolder.elementId,
      flex_main_folder_number: mainFolder.elementNumber,
      flex_folders_created: true
    };

    // Include all departments to match the job creation
    const departments = ['sound', 'lights', 'video', 'production', 'personnel', 'comercial'] as const;
    
    for (const dept of departments) {
      const subFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: mainFolder.elementId,
        open: true,
        locked: false,
        name: `${tour.name} - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        notes: `Manual subfolder creation for ${dept}`,
        documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept]
      };

      console.log(`Creating subfolder for ${dept} with payload:`, subFolderPayload);

      try {
        const subFolder = await createFlexFolder(subFolderPayload);
        console.log(`${dept} subfolder created:`, subFolder);

        folderUpdates[`flex_${dept}_folder_id`] = subFolder.elementId;
        folderUpdates[`flex_${dept}_folder_number`] = subFolder.elementNumber;

        await supabase
          .from("flex_folders")
          .insert({
            job_id: null,
            parent_id: mainFolder.elementId,
            element_id: subFolder.elementId,
            department: dept,
            folder_type: "tour_department"
          });

        // Create department-specific hojaInfo elements for sound, lights, and video only
        if (["sound", "lights", "video"].includes(dept)) {
          const hojaInfoType = dept === "sound" 
            ? FLEX_FOLDER_IDS.hojaInfoSx 
            : dept === "lights" 
              ? FLEX_FOLDER_IDS.hojaInfoLx 
              : FLEX_FOLDER_IDS.hojaInfoVx;
          
          const hojaInfoSuffix = dept === "sound" ? "SIP" : dept === "lights" ? "LIP" : "VIP";
          
          const hojaInfoPayload = {
            definitionId: hojaInfoType,
            parentElementId: subFolder.elementId,
            open: true,
            locked: false,
            name: `Hoja de Información - ${tour.name}`,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            departmentId: DEPARTMENT_IDS[dept],
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${hojaInfoSuffix}`,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept]
          };
          
          console.log(`Creating hojaInfo element for ${dept}:`, hojaInfoPayload);
          try {
            await createFlexFolder(hojaInfoPayload);
          } catch (err) {
            console.error(`Exception creating hojaInfo for ${dept}:`, err);
          }
        }

        // Create additional subfolders only for technical departments (sound, lights, video, production)
        if (["sound", "lights", "video", "production"].includes(dept)) {
          const additionalSubfolders = [
            {
              definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
              name: `Documentación Técnica - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
              suffix: "DT"
            },
            {
              definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
              name: `Presupuestos Recibidos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
              suffix: "PR"
            },
            {
              definitionId: FLEX_FOLDER_IDS.hojaGastos,
              name: `Hoja de Gastos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
              suffix: "HG"
            }
          ];

          for (const sf of additionalSubfolders) {
            const childPayload = {
              definitionId: sf.definitionId,
              parentElementId: subFolder.elementId,
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
            console.log(`Creating additional subfolder for ${dept} with payload:`, childPayload);
            try {
              await createFlexFolder(childPayload);
            } catch (err) {
              console.error(`Exception creating additional subfolder for ${dept}:`, err);
              continue;
            }
          }
        }

      } catch (error) {
        console.error(`Error creating ${dept} subfolder:`, error);
        continue;
      }
    }

    const { error: updateError } = await supabase
      .from("tours")
      .update(folderUpdates)
      .eq("id", tour.id);

    if (updateError) {
      console.error("Error updating tour with folder info:", updateError);
      throw updateError;
    }

    return { success: true, data: folderUpdates };
  } catch (error: any) {
    console.error("Exception creating tour root folders manually:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}

export async function createAllTourFolders(tourId: string): Promise<TourFolderCreationResult> {
  try {
    console.log("Creating all tour folders for:", tourId);
    
    const { data, error } = await supabase.functions.invoke('create-flex-folders', {
      body: {
        tourId,
        createRootFolders: true,
        createDateFolders: true
      }
    });

    if (error) {
      console.error("Error creating all tour folders:", error);
      return { success: false, error: error.message || "Failed to create tour folders" };
    }

    console.log("Successfully created all tour folders:", data);
    return { success: true, data };
  } catch (error: any) {
    console.error("Exception creating all tour folders:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}
