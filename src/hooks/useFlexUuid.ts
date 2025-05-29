import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useFlexUuid = (jobId: string) => {
  const [flexUuid, setFlexUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlexUuid = async () => {
      try {
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

        // First, try to fetch from the 'tours' table for flex_main_folder_id
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select('flex_main_folder_id')
          .eq('id', jobId) // jobId here refers to tour.id when used in TourManagement.tsx
          .single();

        if (tourData && tourData.flex_main_folder_id) {
          uuid = tourData.flex_main_folder_id;
          console.log('Found flex_main_folder_id in tours table:', uuid);
        } else if (tourError && tourError.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error('Error fetching tour flex_main_folder_id:', tourError);
          // Do not return here, continue to try fetching from jobs table
        }

        // If not found in 'tours' table, try fetching from 'flex_folders' for tourdate or job
        if (!uuid) {
          // Check if the jobId corresponds to a tour_date
          const { data: tourDateCheck, error: tourDateError } = await supabase
            .from('tour_dates')
            .select('id')
            .eq('id', jobId)
            .single();

          if (tourDateCheck) {
            // If it's a tourdate, use the specific pattern for tourdates
            console.log('Processing tourdate ID:', jobId);
            const { data: flexFolder, error } = await supabase
              .from('flex_folders')
              .select('element_id')
              .eq('tour_date_id', jobId)
              .eq('folder_type', 'tourdate')
              .eq('department', profile.department)
              .single();

            if (error) {
              console.log('Error fetching tourdate flex folder:', error);
            } else {
              uuid = flexFolder?.element_id || null;
              console.log('Tourdate UUID found:', uuid);
            }
          } else {
            // If not a tourdate, proceed with existing logic for jobs
            // Get job details to determine job type and tour_date_id
            const { data: job } = await supabase
              .from('jobs')
              .select('job_type, tour_date_id')
              .eq('id', jobId)
              .single();

            if (!job) {
              console.log('No job found');
              setIsLoading(false);
              return;
            }

            console.log('Job details:', job);

            if (job.job_type === 'tourdate') {
              // For tourdate jobs: prioritize job-specific, then tour_date-specific, then fallback to generic
              console.log('Processing tourdate job...');

              // First try: job-specific folders
              const { data: jobSpecificFolders } = await supabase
                .from('flex_folders')
                .select('element_id, parent_id, department') // Include department in select
                .eq('job_id', jobId)
                .eq('department', profile.department);

              if (jobSpecificFolders && jobSpecificFolders.length > 0) {
                // For tourdates, always prioritize element_id if department matches
                const folder = jobSpecificFolders.find(f => f.department === profile.department);
                uuid = folder?.element_id || null;
                console.log('Found job-specific tourdate folder with matching department element_id:', uuid);
              }

              if (!uuid && job.tour_date_id) {
                // Second try: tour_date-specific folders
                const { data: tourDateFolders } = await supabase
                  .from('flex_folders')
                  .select('element_id, parent_id, department') // Include department in select
                  .eq('tour_date_id', job.tour_date_id)
                  .eq('department', profile.department);

                if (tourDateFolders && tourDateFolders.length > 0) {
                  // For tourdates, always prioritize element_id if department matches
                  const folder = tourDateFolders.find(f => f.department === profile.department);
                  uuid = folder?.element_id || null;
                  console.log('Found tour_date-specific folder with matching department element_id:', uuid);
                }
              }

              if (!uuid) {
                // Fallback: generic department mapping for tourdates
                const departmentMapping: { [key: string]: string } = {
                  sound: 'sound',
                  lights: 'lights',
                  video: 'video',
                  production: 'production',
                  logistics: 'production'
                };

                const mappedDepartment = departmentMapping[profile.department];
                console.log('Falling back to generic tourdate mapping for department:', mappedDepartment);

                if (mappedDepartment) {
                  const { data: flexFolder, error } = await supabase
                    .from('flex_folders')
                    .select('element_id')
                    .eq('folder_type', 'tour_department')
                    .eq('department', mappedDepartment)
                    .single();

                  if (error) {
                    console.log('Error fetching generic tourdate flex folder:', error);
                  } else {
                    uuid = flexFolder?.element_id || null;
                    console.log('Generic tourdate UUID found:', uuid);
                  }
                }
              }
            } else {
              // For non-tourdate jobs: prioritize job-specific, then fallback to generic
              console.log('Processing non-tourdate job...');

              // First try: job-specific folders
              const { data: jobSpecificFolders } = await supabase
                .from('flex_folders')
                .select('element_id, parent_id, department') // Include department in select
                .eq('job_id', jobId)
                .eq('department', profile.department);

              if (job.job_type === 'dryhire') {
                // For dryhire jobs: prioritize element_id
                if (jobSpecificFolders && jobSpecificFolders.length > 0) {
                  uuid = jobSpecificFolders[0].element_id;
                  console.log('Found job-specific dryhire folder with element_id:', uuid);
                } else {
                  // Fallback: generic department lookup for dryhire
                  console.log('No job-specific dryhire folders found, falling back to generic department lookup');
                  const { data: flexFolders, error } = await supabase
                    .from('flex_folders')
                    .select('element_id, department')
                    .eq('department', profile.department);

                  if (error) {
                    console.log('Error fetching generic dryhire flex folders:', error);
                  } else {
                    const departmentFolder = flexFolders?.find(f => f.department === profile.department);
                    uuid = departmentFolder?.element_id || null;
                    console.log('Using generic dryhire element_id:', uuid);
                  }
                }
              } else {
                // For other non-tourdate jobs: prioritize parent_id, then fallback to generic
                if (jobSpecificFolders && jobSpecificFolders.length > 0) {
                  const folder = jobSpecificFolders.find(f => f.parent_id !== null && f.parent_id !== undefined);
                  if (folder) {
                    uuid = folder.parent_id;
                    console.log('Found job-specific folder with parent_id:', uuid);
                  } else {
                    uuid = jobSpecificFolders[0].element_id;
                    console.log('Found job-specific folder with element_id:', uuid);
                  }
                } else {
                  // Fallback: generic department lookup
                  console.log('No job-specific folders found, falling back to generic department lookup');

                  const { data: flexFolders, error } = await supabase
                    .from('flex_folders')
                    .select('parent_id, element_id, department')
                    .eq('department', profile.department);

                  if (error) {
                    console.log('Error fetching generic flex folders:', error);
                  } else {
                    console.log('Generic flex folders found:', flexFolders);

                    if (flexFolders && flexFolders.length > 0) {
                      // First try to find a parent_id that's not null
                      const folderWithParent = flexFolders.find(f => f.parent_id !== null && f.parent_id !== undefined);
                      if (folderWithParent) {
                        uuid = folderWithParent.parent_id;
                        console.log('Using generic parent_id:', uuid);
                      } else {
                        // Fallback to element_id from department match
                        const departmentFolder = flexFolders.find(f => f.department === profile.department);
                        uuid = departmentFolder?.element_id || null;
                        console.log('Using generic fallback element_id:', uuid);
                      }
                    } else {
                      console.log('No generic flex folders found for department');
                    }
                  }
                }
              }
            }
          }
        }

        console.log('Final UUID set for job', jobId, ':', uuid);
        setFlexUuid(uuid);
      } catch (error) {
        console.error('Error fetching flex UUID:', error);
        setError('Failed to fetch flex UUID');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlexUuid();
  }, [jobId]);

  return { flexUuid, isLoading, error };
};
