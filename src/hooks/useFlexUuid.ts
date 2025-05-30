
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
          setFlexUuid(null);
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
          setFlexUuid(null);
          setIsLoading(false);
          return;
        }

        console.log('User department:', profile.department);
        console.log('Looking for UUID for ID:', jobId);

        let uuid: string | null = null;

        // First, check if this is a tour ID by looking in the tours table
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select('flex_main_folder_id')
          .eq('id', jobId)
          .single();

        if (tourData && tourData.flex_main_folder_id) {
          uuid = tourData.flex_main_folder_id;
          console.log('Found tour flex_main_folder_id:', uuid);
          setFlexUuid(uuid);
          setIsLoading(false);
          return;
        }

        // Check if this is a tour_date ID
        const { data: tourDateData, error: tourDateError } = await supabase
          .from('tour_dates')
          .select('id')
          .eq('id', jobId)
          .single();

        if (tourDateData) {
          console.log('Processing tour date ID:', jobId);
          // For tour dates, look for tourdate folder type
          const { data: tourDateFolder, error: tourDateFolderError } = await supabase
            .from('flex_folders')
            .select('element_id')
            .eq('tour_date_id', jobId)
            .eq('folder_type', 'tourdate')
            .eq('department', profile.department)
            .single();

          if (tourDateFolderError) {
            console.log('Error fetching tourdate flex folder:', tourDateFolderError);
          } else if (tourDateFolder) {
            uuid = tourDateFolder.element_id;
            console.log('Tour date UUID found:', uuid);
          }
          
          setFlexUuid(uuid);
          setIsLoading(false);
          return;
        }

        // If not a tour or tour_date, treat as a job
        console.log('Processing as job ID:', jobId);
        
        // Get job details to determine job type
        const { data: job, error: jobError } = await supabase
          .from('jobs')
          .select('job_type, tour_date_id')
          .eq('id', jobId)
          .single();

        if (jobError || !job) {
          console.log('Error fetching job or job not found:', jobError);
          setFlexUuid(null);
          setIsLoading(false);
          return;
        }

        console.log('Job details:', job);

        if (job.job_type === 'single') {
          // For single jobs: get element_id from flex_folders where job_id matches and department matches
          console.log('Processing single job - looking for department folder...');
          
          const { data: singleJobFolder, error: singleJobError } = await supabase
            .from('flex_folders')
            .select('element_id')
            .eq('job_id', jobId)
            .eq('folder_type', 'department')
            .eq('department', profile.department)
            .single();

          if (singleJobError) {
            console.log('Error fetching single job folder:', singleJobError);
          } else if (singleJobFolder) {
            uuid = singleJobFolder.element_id;
            console.log('Single job UUID found:', uuid);
          }
          
        } else if (job.job_type === 'tourdate') {
          // For tourdate jobs: look for tour_department folder with matching department
          console.log('Processing tourdate job - looking for tour_department folder...');

          const { data: tourDeptFolder, error: tourDeptError } = await supabase
            .from('flex_folders')
            .select('element_id')
            .eq('folder_type', 'tour_department')
            .eq('department', profile.department)
            .single();

          if (tourDeptError) {
            console.log('Error fetching tour_department folder:', tourDeptError);
          } else if (tourDeptFolder) {
            uuid = tourDeptFolder.element_id;
            console.log('Tour department UUID found:', uuid);
          }
          
        } else {
          // For other job types (dryhire, festival, etc.): look for job-specific folders
          console.log('Processing other job type:', job.job_type);

          const { data: jobSpecificFolders, error: jobSpecificError } = await supabase
            .from('flex_folders')
            .select('element_id, parent_id, department, folder_type')
            .eq('job_id', jobId);

          if (jobSpecificError) {
            console.log('Error fetching job-specific folders:', jobSpecificError);
          } else if (jobSpecificFolders && jobSpecificFolders.length > 0) {
            console.log('Job-specific folders found:', jobSpecificFolders);
            
            // Try to find folder matching user's department first
            const departmentMatch = jobSpecificFolders.find(f => f.department === profile.department);
            
            if (departmentMatch) {
              if (job.job_type === 'dryhire') {
                uuid = departmentMatch.element_id;
                console.log('Found department-matched dryhire folder element_id:', uuid);
              } else {
                // For other job types, prioritize parent_id
                uuid = departmentMatch.parent_id || departmentMatch.element_id;
                console.log('Found department-matched folder parent_id/element_id:', uuid);
              }
            } else {
              // If no department match, use any available folder
              const anyFolder = jobSpecificFolders[0];
              if (job.job_type === 'dryhire') {
                uuid = anyFolder.element_id;
                console.log('Using any available dryhire folder element_id:', uuid);
              } else {
                uuid = anyFolder.parent_id || anyFolder.element_id;
                console.log('Using any available folder parent_id/element_id:', uuid);
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
      setIsLoading(false);
    }
  }, [jobId]);

  return { flexUuid, isLoading, error };
};
