import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useFlexUuid = (jobId: string) => {
  const [flexUuid, setFlexUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlexUuid = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get current user's department
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('No user found');
          setIsLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.department) {
          console.error('Error fetching user department:', profileError);
          console.log('No user department found');
          setIsLoading(false);
          setError('Could not determine user department.');
          return;
        }

        console.log('User department:', profile.department);

        let uuid: string | null = null;

        // 1. Check if this is a tour ID and get department-specific flex folder ID
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select(`
            flex_main_folder_id,
            flex_sound_folder_id,
            flex_lights_folder_id,
            flex_video_folder_id,
            flex_production_folder_id,
            flex_personnel_folder_id,
            flex_comercial_folder_id
          `)
          .eq('id', jobId)
          .single();

        if (tourError && tourError.code !== 'PGRST116') { // PGRST116 means no rows found
           console.error('Error fetching tour data:', tourError);
           // Continue to next check
        } else if (tourData) {
          const department = profile.department?.toLowerCase();
          switch (department) {
            case 'sound':
              uuid = tourData.flex_sound_folder_id;
              break;
            case 'lights':
              uuid = tourData.flex_lights_folder_id;
              break;
            case 'video':
              uuid = tourData.flex_video_folder_id;
              break;
            case 'production':
              uuid = tourData.flex_production_folder_id;
              break;
            case 'personnel': // Assuming 'personnel' department exists
              uuid = tourData.flex_personnel_folder_id;
              break;
            case 'comercial': // Assuming 'comercial' department exists
              uuid = tourData.flex_comercial_folder_id;
              break;
            default:
              // Fallback to main folder if department is not specifically handled or is null
              uuid = tourData.flex_main_folder_id;
              break;
          }
          if (uuid) {
              console.log(`Found department-specific (${department}) or main flex folder ID in tours table:`, uuid);
          } else if (tourData.flex_main_folder_id) {
              uuid = tourData.flex_main_folder_id;
              console.log('Using fallback flex_main_folder_id from tours table:', uuid);
          }
        }

        // 2. If not a tour, check if it's a tour_date ID by querying flex_folders directly
        if (!uuid) {
          const { data: tourDateFlexFolder, error: tourDateFlexError } = await supabase
            .from('flex_folders')
            .select('element_id')
            .eq('tour_date_id', jobId)
            .eq('folder_type', 'tourdate')
            .eq('department', profile.department)
            .single();

          if (tourDateFlexError && tourDateFlexError.code !== 'PGRST116') {
             console.error('Error fetching tour_date flex folder:', tourDateFlexError);
             // Continue to next check
          } else if (tourDateFlexFolder?.element_id) {
            uuid = tourDateFlexFolder.element_id;
            console.log('Tour_date specific UUID found in flex_folders:', uuid);
          }
        }

        // 3. If not a tour or tour_date flex folder, check if it's a regular job ID by querying flex_folders
        if (!uuid) {
           // First, get the job type
           const { data: jobData, error: jobDataError } = await supabase
             .from('jobs')
             .select('job_type')
             .eq('id', jobId)
             .single();

           if (jobDataError && jobDataError.code !== 'PGRST116') {
              console.error('Error fetching job data:', jobDataError);
              // Continue, uuid remains null
           } else if (jobData) {
              console.log('Job type for ID', jobId, ':', jobData.job_type);

              // Then, query flex_folders for this job and department
              const { data: jobFlexFolder, error: jobFlexError } = await supabase
                .from('flex_folders')
                .select('parent_id, element_id')
                .eq('job_id', jobId)
                .eq('department', profile.department)
                .single(); // Assuming a job has a single relevant flex folder per department

              if (jobFlexError && jobFlexError.code !== 'PGRST116') {
                 console.error('Error fetching job flex folder:', jobFlexError);
                 // Continue, uuid remains null
              } else if (jobFlexFolder) {
                 // Determine which UUID to use based on job type
                 if (jobData.job_type === 'dryhire') { // Corrected enum value
                    uuid = jobFlexFolder.element_id || null;
                    console.log('Dry hire job: Using element_id:', uuid);
                 } else {
                    // For other job types, prefer parent_id, fallback to element_id
                    uuid = jobFlexFolder.parent_id || jobFlexFolder.element_id || null;
                    console.log('Non-dry hire job: Using parent_id or element_id:', uuid);
                 }
              }
           }
        }


        console.log('Final UUID set for ID', jobId, ':', uuid);
        setFlexUuid(uuid);

      } catch (error) {
        console.error('Error fetching flex UUID:', error);
        setError('Failed to fetch flex UUID');
        setFlexUuid(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId) {
      fetchFlexUuid();
    } else {
      // If jobId is null or undefined, reset state
      setFlexUuid(null);
      setIsLoading(false);
      setError(null);
    }
  }, [jobId]); // Added jobId to dependency array

  return { flexUuid, isLoading, error };
};
