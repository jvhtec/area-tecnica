import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { useLocationManagement } from "@/hooks/useLocationManagement";
import { 
  FLEX_FOLDER_IDS, 
  DEPARTMENT_IDS, 
  RESPONSIBLE_PERSON_IDS, 
  DEPARTMENT_SUFFIXES 
} from "@/utils/flex-folders/constants";

interface TourCreationData {
  title: string;
  description: string;
  dates: { date: string; location: string }[];
  color: string;
  departments: Department[];
  startDate?: string;
  endDate?: string;
}

export const useTourCreationMutation = () => {
  const { getOrCreateLocation } = useLocationManagement();

  const createFlexFolder = async (payload: Record<string, any>) => {
    console.log("Creating Flex folder with payload:", payload);
    
    try {
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
    } catch (error) {
      console.error("Error creating Flex folder:", error);
      throw error;
    }
  };

  const createFlexFolders = async (tour: any, startDate: string, endDate: string) => {
    console.log("Creating Flex folders for tour:", tour.id);
    
    try {
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
        notes: "Automated folder creation from Web App",
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
          notes: `Automated subfolder creation for ${dept}`,
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
          // Skip personnel and comercial departments to keep them empty
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

            // Note: Removed pullsheet creation for sound department in tour roots
            // Pullsheets (Tour Pack, PA) should only be created for individual jobs, not tour roots
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

      return folderUpdates;
    } catch (error) {
      console.error("Error creating Flex folders:", error);
      throw error;
    }
  };

  const createTourWithDates = async ({
    title,
    description,
    dates,
    color,
    departments,
    startDate,
    endDate,
  }: TourCreationData) => {
    console.log("Starting tour creation process...");
    
    const validDates = dates.filter((date) => date.date);

    if (validDates.length === 0) {
      throw new Error("At least one valid date is required");
    }

    validDates.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .insert({
        name: title,
        description,
        start_date: startDate || validDates[0].date,
        end_date: endDate || validDates[validDates.length - 1].date,
        color,
      })
      .select()
      .single();

    if (tourError) throw tourError;

    try {
      await createFlexFolders(
        tour,
        startDate || validDates[0].date,
        endDate || validDates[validDates.length - 1].date
      );

      for (const dateInfo of validDates) {
        let locationId = null;
        let locationName = "No Location";
        
        if (dateInfo.location) {
          locationId = await getOrCreateLocation(dateInfo.location);
          locationName = dateInfo.location;
        }
        
        const { data: tourDate, error: tourDateError } = await supabase
          .from("tour_dates")
          .insert({
            tour_id: tour.id,
            date: dateInfo.date,
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

        if (tourDateError) throw tourDateError;

        const { data: dateJob, error: dateJobError } = await supabase
          .from("jobs")
          .insert({
            title: `${title} (${locationName})`,
            description,
            start_time: `${dateInfo.date}T00:00:00`,
            end_time: `${dateInfo.date}T23:59:59`,
            location_id: locationId,
            job_type: "tourdate",
            tour_date_id: tourDate.id,
            tour_id: tour.id,
            color,
          })
          .select()
          .single();

        if (dateJobError) throw dateJobError;

        const dateDepartments = departments.map((department) => ({
          job_id: dateJob.id,
          department,
        }));

        const { error: dateDeptError } = await supabase
          .from("job_departments")
          .insert(dateDepartments);

        if (dateDeptError) throw dateDeptError;

        // Create job_date_types entry for the tour date job
        const { error: dateTypeError } = await supabase
          .from("job_date_types")
          .upsert({
            job_id: dateJob.id,
            date: dateInfo.date,
            type: "show" // Default to show, can be changed later
          });

        if (dateTypeError) throw dateTypeError;
      }

      return tour;
    } catch (error) {
      console.error("Error processing tour creation:", error);
      await supabase.from("tours").delete().eq("id", tour.id);
      throw error;
    }
  };

  return {
    createTourWithDates,
  };
};
