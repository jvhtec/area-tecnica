import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { useLocationManagement } from "@/hooks/useLocationManagement";
import { 
  FLEX_FOLDER_IDS, 
  DEPARTMENT_IDS, 
  RESPONSIBLE_PERSON_IDS, 
  DEPARTMENT_SUFFIXES 
} from "@/utils/flex-folders/constants";

const BASE_URL = "https://sectorpro.flexrentalsolutions.com/f5/api/element";
const API_KEY = "82b5m0OKgethSzL1YbrWMUFvxdNkNMjRf82E";

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
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Flex API error:", errorData);
      throw new Error(errorData.exceptionMessage || "Failed to create folder in Flex");
    }

    const data = await response.json();
    console.log("Created Flex folder:", data);
    return data;
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

      const mainResponse = await fetch(BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": API_KEY
        },
        body: JSON.stringify(mainFolderPayload)
      });

      if (!mainResponse.ok) {
        const errorData = await mainResponse.json();
        console.error("Flex API error creating main folder:", errorData);
        throw new Error(errorData.exceptionMessage || "Failed to create main folder");
      }

      const mainFolder = await mainResponse.json();
      console.log("Main folder created:", mainFolder);

      const folderUpdates: any = {
        flex_main_folder_id: mainFolder.elementId,
        flex_main_folder_number: mainFolder.elementNumber,
        flex_folders_created: true
      };

      // Include all departments to match the job creation
      const departments = ['sound', 'lights', 'video', 'production', 'personnel', 'comercial'] as const;
      
      for (const dept of departments) {
        try {
          console.log(`Starting creation of ${dept} department folder`);
          
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

          const subResponse = await fetch(BASE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Auth-Token": API_KEY
            },
            body: JSON.stringify(subFolderPayload)
          });

          if (!subResponse.ok) {
            const errorData = await subResponse.json();
            console.error(`Error creating ${dept} subfolder:`, errorData);
            continue;
          }

          const subFolder = await subResponse.json();
          console.log(`${dept} subfolder created:`, subFolder);

          // Store the folder ID and number using the correct field name
          const idFieldName = `flex_${dept}_folder_id`;
          const numberFieldName = `flex_${dept}_folder_number`;
          
          folderUpdates[idFieldName] = subFolder.elementId;
          folderUpdates[numberFieldName] = subFolder.elementNumber;

          console.log(`Added folder data to updates: ${idFieldName}=${subFolder.elementId}`);

          await supabase
            .from("flex_folders")
            .insert({
              job_id: null,
              parent_id: mainFolder.elementId,
              element_id: subFolder.elementId,
              department: dept,
              folder_type: "tour_department"
            });

          // Create department-specific hojaInfo elements for sound, lights, and video
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

          if (dept !== "personnel") {
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

            // Add specific folders for sound department
            if (dept === "sound") {
              const soundSubfolders = [
                { name: `${tour.name} - Tour Pack`, suffix: "TP" },
                { name: `${tour.name} - PA`, suffix: "PA" },
              ];

              for (const sf of soundSubfolders) {
                const subPayload = {
                  definitionId: FLEX_FOLDER_IDS.pullSheet,
                  parentElementId: subFolder.elementId,
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
                
                try {
                  await createFlexFolder(subPayload);
                } catch (err) {
                  console.error(`Exception creating sound subfolder for ${sf.name}:`, err);
                }
              }
            }
          } else if (dept === "personnel") {
            // Special folders for personnel department
            const personnelSubfolders = [
              { name: `Gastos de Personal - ${tour.name}`, suffix: "GP", definitionId: FLEX_FOLDER_IDS.subFolder },
            ];

            for (const sf of personnelSubfolders) {
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
              console.log(`Creating personnel subfolder with payload:`, childPayload);
              try {
                await createFlexFolder(childPayload);
              } catch (err) {
                console.error(`Exception creating personnel subfolder:`, err);
              }
            }

            const personnelcrewCall = [
              { name: `Crew Call Sonido - ${tour.name}`, suffix: "CCS" },  
              { name: `Crew Call Luces - ${tour.name}`, suffix: "CCL" },
            ];

            for (const sf of personnelcrewCall) {
              const crewCallPayload = {
                definitionId: FLEX_FOLDER_IDS.crewCall,
                parentElementId: subFolder.elementId,
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
              
              try {
                await createFlexFolder(crewCallPayload);
              } catch (err) {
                console.error(`Exception creating crew call folder for ${sf.name}:`, err);
              }
            }
          }
        } catch (deptError) {
          console.error(`Error processing department ${dept}:`, deptError);
          // Continue with other departments even if one fails
        }
      }

      console.log("About to update tour with folder info:", folderUpdates);
      console.log("Department folder IDs:", {
        sound: folderUpdates.flex_sound_folder_id,
        lights: folderUpdates.flex_lights_folder_id,
        video: folderUpdates.flex_video_folder_id,
        production: folderUpdates.flex_production_folder_id,
        personnel: folderUpdates.flex_personnel_folder_id,
        comercial: folderUpdates.flex_comercial_folder_id
      });

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
