import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { useLocationManagement } from "@/hooks/useLocationManagement";

const BASE_URL = "https://sectorpro.flexrentalsolutions.com/f5/api/element";
const API_KEY = "82b5m0OKgethSzL1YbrWMUFvxdNkNMjRf82E";

const FLEX_FOLDER_IDS = {
  mainFolder: "e281e71c-2c42-49cd-9834-0eb68135e9ac",
  subFolder: "358f312c-b051-11df-b8d5-00e08175e43e",
  location: "2f49c62c-b139-11df-b8d5-00e08175e43e",
  mainResponsible: "4bc2df20-e700-11ea-97d0-2a0a4490a7fb",
  documentacionTecnica: "3787806c-af2d-11df-b8d5-00e08175e43e",
  presupuestosRecibidos: "3787806c-af2d-11df-b8d5-00e08175e43e",
  hojaGastos: "566d32e0-1a1e-11e0-a472-00e08175e43e"
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

      const departments = ['sound', 'lights', 'video', 'production', 'personnel'] as const;
      
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

        const additionalSubfolders = [
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
            const childResponse = await fetch(BASE_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Auth-Token": API_KEY
              },
              body: JSON.stringify(childPayload)
            });
            if (!childResponse.ok) {
              const errorData = await childResponse.json();
              console.error(`Error creating additional subfolder for ${dept}:`, errorData);
              continue;
            }
            const childFolder = await childResponse.json();
            console.log(`Additional subfolder created for ${dept}:`, childFolder);
          } catch (err) {
            console.error(`Exception creating additional subfolder for ${dept}:`, err);
            continue;
          }
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
        if (dateInfo.location) {
          locationId = await getOrCreateLocation(dateInfo.location);
        }
        
        const { data: tourDate, error: tourDateError } = await supabase
          .from("tour_dates")
          .insert({
            tour_id: tour.id,
            date: dateInfo.date,
            location_id: locationId,
          })
          .select()
          .single();

        if (tourDateError) throw tourDateError;

        const { data: dateJob, error: dateJobError } = await supabase
          .from("jobs")
          .insert({
            title: `${title} (Tour Date)`,
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
