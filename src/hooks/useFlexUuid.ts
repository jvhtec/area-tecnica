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

        const { data: profile } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', user.id)
          .single();

        if (!profile?.department) {
          console.log('No user department found');
          setIsLoading(false);
          return;
        }

        console.log('User department:', profile.department);

        let uuid: string | null = null;

        // First check if this is a direct tour ID (from TourManagement context)
        const { data: tourData } = await supabase
          .from('tours')
          .select('flex_main_folder_id')
          .eq('id', jobId)
          .single();

        if (tourData?.flex_main_folder_id) {
          uuid = tourData.flex_main_folder_id;
          console.log('Found flex_main_folder_id in tours table:', uuid);
        } else {
          // Check if this is a tour_date ID
          const { data: tourDateData } = await supabase
            .from('tour_dates')
            .select('id')
            .eq('id', jobId)
            .single();

          if (tourDateData) {
            // This is a tour_date - look for specific folder
            console.log('Processing tour_date ID:', jobId);
            
            const { data: flexFolder } = await supabase
              .from('flex_folders')
              .select('element_id')
              .eq('tour_date_id', jobId)
              .eq('folder_type', 'tourdate')
              .eq('department', profile.department)
              .single();

            uuid = flexFolder?.element_id || null;
            console.log('Tour_date specific UUID found:', uuid);
          } else {
            // This is a regular job - get job details
            const { data: job } = await supabase
              .from('jobs')
              .select('job_type')
              .eq('id', jobId)
              .single();

            if (!job) {
              console.log('No job found with ID:', jobId);
              setIsLoading(false);
              return;
            }

            console.log('Job type:', job.job_type);

            if (job.job_type === 'tourdate') {
              // For tourdate jobs: use element_id with folder_type = 'tour_department'
              const departmentMapping: { [key: string]: string } = {
                sound: 'sound',
                lights: 'lights',
                video: 'video',
                production: 'production',
                logistics: 'production'
              };

              const mappedDepartment = departmentMapping[profile.department];
              console.log('Mapped department for tourdate:', mappedDepartment);

              if (mappedDepartment) {
                const { data: flexFolder } = await supabase
                  .from('flex_folders')
                  .select('element_id')
                  .eq('folder_type', 'tour_department')
                  .eq('department', mappedDepartment)
                  .single();

                uuid = flexFolder?.element_id || null;
                console.log('Tourdate UUID found:', uuid);
              }
            } else {
              // For non-tourdate jobs: prefer parent_id, fallback to element_id
              console.log('Processing non-tourdate job for department:', profile.department);

              const { data: flexFolders } = await supabase
                .from('flex_folders')
                .select('parent_id, element_id')
                .eq('department', profile.department);

              console.log('Flex folders found:', flexFolders);

              if (flexFolders && flexFolders.length > 0) {
                // First try to find a parent_id that's not null
                const folderWithParent = flexFolders.find(f => f.parent_id !== null && f.parent_id !== undefined);
                if (folderWithParent) {
                  uuid = folderWithParent.parent_id;
                  console.log('Using parent_id:', uuid);
                } else {
                  // Fallback to element_id
                  uuid = flexFolders[0].element_id;
                  console.log('Using fallback element_id:', uuid);
                }
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
    }
  }, [jobId]);

  return { flexUuid, isLoading, error };
};