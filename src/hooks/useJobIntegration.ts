
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { EventData } from "@/types/hoja-de-ruta";

export const useJobIntegration = (jobId: string) => {
  // Fetch job details
  const { data: jobDetails, isLoading: isLoadingJob } = useQuery({
    queryKey: ['job-details', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      
      console.log("🔍 JOB INTEGRATION: Fetching job details for:", jobId);
      
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          job_assignments(
            *,
            profiles:technician_id(first_name, last_name)
          )
        `)
        .eq('id', jobId)
        .single();

      if (error) {
        console.error('❌ JOB INTEGRATION: Error fetching job:', error);
        throw error;
      }

      console.log("✅ JOB INTEGRATION: Job details fetched");
      return data;
    },
    enabled: !!jobId
  });

  // Generate event data from job details
  const generateEventDataFromJob = (): Partial<EventData> => {
    if (!jobDetails) return {};

    console.log("🔄 JOB INTEGRATION: Generating event data from job");

    const startDate = jobDetails.start_time ? new Date(jobDetails.start_time) : null;
    const endDate = jobDetails.end_time ? new Date(jobDetails.end_time) : null;
    
    let eventDates = "";
    if (startDate && endDate) {
      if (startDate.toDateString() === endDate.toDateString()) {
        eventDates = startDate.toLocaleDateString('es-ES');
      } else {
        eventDates = `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`;
      }
    }

    const contacts = [];
    if (jobDetails.client_name) {
      contacts.push({
        name: jobDetails.client_name,
        role: "Cliente",
        phone: jobDetails.client_phone || ""
      });
    }

    const staff = jobDetails.job_assignments?.map((assignment: any) => ({
      name: assignment.profiles?.first_name || "",
      surname1: assignment.profiles?.last_name || "",
      surname2: "",
      position: assignment.sound_role || assignment.lights_role || assignment.video_role || "Técnico"
    })) || [];

    return {
      eventName: jobDetails.title || "",
      eventDates,
      venue: {
        name: jobDetails.venue || "",
        address: jobDetails.location || ""
      },
      contacts: contacts.length > 0 ? contacts : [{ name: "", role: "", phone: "" }],
      staff: staff.length > 0 ? staff : [{ name: "", surname1: "", surname2: "", position: "" }],
      logistics: {
        transport: "",
        loadingDetails: "",
        unloadingDetails: "",
        equipmentLogistics: ""
      },
      schedule: startDate ? `Load in: ${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : "",
      powerRequirements: "",
      auxiliaryNeeds: ""
    };
  };

  return {
    jobDetails,
    isLoadingJob,
    generateEventDataFromJob
  };
};
