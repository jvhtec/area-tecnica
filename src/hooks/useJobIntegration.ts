import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { EventData } from '@/types/hoja-de-ruta';

export const useJobIntegration = (jobId?: string) => {
  // Fetch job details for auto-population
  const {
    data: jobDetails,
    isLoading: isLoadingJob,
    error: jobError
  } = useQuery({
    queryKey: ['job-details', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          locations (
            name,
            formatted_address,
            latitude,
            longitude
          ),
          job_assignments (
            technician_id,
            sound_role,
            lights_role,
            video_role,
            profiles (
              first_name,
              last_name,
              department
            )
          )
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!jobId
  });

  // Fetch assigned staff for the job
  const {
    data: assignedStaff = [],
    isLoading: isLoadingStaff,
    error: staffError
  } = useQuery({
    queryKey: ['job-assigned-staff', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          technician_id,
          sound_role,
          lights_role,
          video_role,
          profiles (
            first_name,
            last_name,
            department,
            phone
          )
        `)
        .eq('job_id', jobId);

      if (error) throw error;
      
      // Transform the data to the format expected by EventData
      return data.map(assignment => {
        const profile = Array.isArray(assignment.profiles) 
          ? assignment.profiles[0] 
          : assignment.profiles;
        const roles = [
          assignment.sound_role,
          assignment.lights_role,
          assignment.video_role
        ].filter(Boolean);

        return {
          name: profile?.first_name || '',
          surname1: profile?.last_name || '',
          surname2: '',
          position: roles.join(', ') || profile?.department || 'Técnico'
        };
      });
    },
    enabled: !!jobId
  });

  // Function to auto-populate event data from job
  const generateEventDataFromJob = (): Partial<EventData> => {
    if (!jobDetails) return {};

    const eventData: Partial<EventData> = {
      eventName: jobDetails.title || '',
      eventDates: jobDetails.start_time && jobDetails.end_time 
        ? `${new Date(jobDetails.start_time).toLocaleDateString('es-ES')} - ${new Date(jobDetails.end_time).toLocaleDateString('es-ES')}`
        : '',
      venue: {
        name: jobDetails.locations?.name || '',
        address: jobDetails.locations?.formatted_address || ''
      },
      staff: assignedStaff,
      contacts: [], // Will need to be filled manually
      logistics: {
        transport: '',
        loadingDetails: '',
        unloadingDetails: '',
        equipmentLogistics: ''
      },
      schedule: `Inicio: ${jobDetails.start_time ? new Date(jobDetails.start_time).toLocaleString('es-ES') : 'Por definir'}\nFin: ${jobDetails.end_time ? new Date(jobDetails.end_time).toLocaleString('es-ES') : 'Por definir'}`,
      powerRequirements: '',
      auxiliaryNeeds: ''
    };

    return eventData;
  };

  return {
    jobDetails,
    assignedStaff,
    isLoadingJob,
    isLoadingStaff,
    jobError,
    staffError,
    generateEventDataFromJob
  };
};