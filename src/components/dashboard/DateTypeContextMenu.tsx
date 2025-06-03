import { useEffect, useState } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Plane, Wrench, Star, Moon, Mic, ExternalLink, Loader2 } from "lucide-react"; // Added Loader2 import
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useTableSubscription } from "@/hooks/useTableSubscription";
// Removed: import { useFlexUuid } from "@/hooks/useFlexUuid"; // No longer needed here

interface DateTypeContextMenuProps {
  children: React.ReactNode;
  jobId: string;
  date: Date;
  onTypeChange: () => void;
}

export const DateTypeContextMenu = ({ children, jobId, date, onTypeChange }: DateTypeContextMenuProps) => {
  const queryClient = useQueryClient();
  const [flexUuid, setFlexUuid] = useState<string | null>(null); // State to store the fetched UUID
  const [isLoadingFlexUuid, setIsLoadingFlexUuid] = useState(false); // State to track loading

  // Use the improved subscription hook with correct parameters
  useTableSubscription('job_date_types', ['job-date-types', jobId]);

  const handleSetDateType = async (type: 'travel' | 'setup' | 'show' | 'off' | 'rehearsal') => {
    try {
      const localDate = startOfDay(date);
      const formattedDate = format(localDate, 'yyyy-MM-dd');

      console.log('Setting date type:', {
        type,
        jobId,
        date: localDate,
        formattedDate,
        originalDate: date
      });

      // Optimistically update the UI
      queryClient.setQueryData(['job-date-types', jobId], (old: any) => {
        const key = `${jobId}-${formattedDate}`;
        return { ...old, [key]: { type, job_id: jobId, date: formattedDate } };
      });

      const { error } = await supabase
        .from('job_date_types')
        .upsert({
          job_id: jobId,
          date: formattedDate,
          type
        }, {
          onConflict: 'job_id,date'
        });

      if (error) throw error;

      // Updated to use proper toast API
      toast.success(`Date type set to ${type}`);
      onTypeChange();
    } catch (error: any) {
      console.error('Error setting date type:', error);
      toast.error('Failed to set date type');
      // Invalidate the query to revert to the correct state
      queryClient.invalidateQueries({ queryKey: ['job-date-types', jobId] });
    }
  };

  const fetchFlexUuid = async () => {
     if (flexUuid || isLoadingFlexUuid || !jobId) return; // Don't fetch if already fetched, loading, or no jobId

     setIsLoadingFlexUuid(true);
     try {
       // Replicate the core logic from useFlexUuid to fetch the UUID
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) {
         toast.error('User not authenticated.');
         setIsLoadingFlexUuid(false);
         return;
       }

       const { data: profile, error: profileError } = await supabase
         .from('profiles')
         .select('department')
         .eq('id', user.id)
         .single();

       if (profileError || !profile?.department) {
         console.error('Error fetching user department:', profileError);
         toast.error('Could not determine user department.');
         setIsLoadingFlexUuid(false);
         return;
       }

       let fetchedUuid: string | null = null;

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

       if (tourError && tourError.code !== 'PGRST116') {
          console.error('Error fetching tour data:', tourError);
       } else if (tourData) {
         const department = profile.department?.toLowerCase();
         switch (department) {
           case 'sound':
             fetchedUuid = tourData.flex_sound_folder_id;
             break;
           case 'lights':
             fetchedUuid = tourData.flex_lights_folder_id;
             break;
           case 'video':
             fetchedUuid = tourData.flex_video_folder_id;
             break;
           case 'personnel':
             fetchedUuid = tourData.flex_personnel_folder_id;
             break;
           case 'comercial':
             fetchedUuid = tourData.flex_comercial_folder_id;
             break;
           case 'production': // Explicitly handle production if it's a department
           case 'logistics': // Map logistics to production
             fetchedUuid = tourData.flex_production_folder_id;
             break;
           default:
             // Default to production folder if department is not specifically handled or is null
             fetchedUuid = tourData.flex_production_folder_id;
             break;
         }
         // If the department-specific folder is null, but main is available, still use main as a last resort
         if (!fetchedUuid && tourData.flex_main_folder_id) {
             fetchedUuid = tourData.flex_main_folder_id;
         }
       }

       // 2. If not a tour, check if it's a tour_date ID by querying flex_folders directly
       if (!fetchedUuid) {
         const { data: tourDateFlexFolder, error: tourDateFlexError } = await supabase
           .from('flex_folders')
           .select('element_id')
           .eq('tour_date_id', jobId)
           .eq('folder_type', 'tourdate')
           .eq('department', profile.department)
           .single();

         if (tourDateFlexError && tourDateFlexError.code !== 'PGRST116') {
            console.error('Error fetching tour_date flex folder:', tourDateFlexError);
         } else if (tourDateFlexFolder?.element_id) {
           fetchedUuid = tourDateFlexFolder.element_id;
         }
       }

       // 3. If not a tour or tour_date flex folder, check if it's a regular job ID
       if (!fetchedUuid) {
          // First, get the job type AND tour_date_id
          const { data: jobData, error: jobDataError } = await supabase
            .from('jobs')
            .select('job_type, tour_date_id') // Fetch tour_date_id
            .eq('id', jobId)
            .single();

          if (jobDataError && jobDataError.code !== 'PGRST116') {
             console.error('Error fetching job data:', jobDataError);
          } else if (jobData) {
              console.log('Job type for ID', jobId, ':', jobData.job_type);

              if (jobData.job_type === 'tourdate' && jobData.tour_date_id) { // Ensure tour_date_id exists
                  // For tourdate jobs: use element_id with folder_type = 'tourdate' and tour_date_id
                  const departmentMapping: { [key: string]: string } = {
                    sound: 'sound',
                    lights: 'lights',
                    video: 'video',
                    production: 'production',
                    logistics: 'production', // Assuming logistics maps to production
                    comercial: 'comercial' // Assuming comercial department exists
                  };

                  // Default to 'production' if department is not found in mapping or is null/empty
                  const mappedDepartment = departmentMapping[profile.department?.toLowerCase() || ''] || 'production';
                  console.log('Mapped department for tourdate job:', mappedDepartment);

                  if (mappedDepartment) {
                    const { data: tourDepartmentFlexFolder, error: tourDepartmentFlexError } = await supabase
                      .from('flex_folders')
                      .select('element_id')
                      .eq('folder_type', 'tourdate') // Corrected folder_type
                      .eq('department', mappedDepartment)
                      .single();

                    if (tourDepartmentFlexError && tourDepartmentFlexError.code !== 'PGRST116') {
                       console.error('Error fetching tour_department flex folder:', tourDepartmentFlexError);
                    } else if (tourDepartmentFlexFolder?.element_id) {
                      fetchedUuid = tourDepartmentFlexFolder.element_id;
                      console.log('Tourdate job: Found UUID from flex_folders (tourdate type):', fetchedUuid);
                    }
                  }
              } else {
                  // For other job types (including dryhire and single): query flex_folders by job_id
                  const { data: jobFlexFolder, error: jobFlexError } = await supabase
                    .from('flex_folders')
                    .select('parent_id, element_id')
                    .eq('job_id', jobId)
                    .eq('department', profile.department)
                    .single(); // Assuming a job has a single relevant flex folder per department

                  if (jobFlexError && jobFlexError.code !== 'PGRST116') {
                     console.error('Error fetching job flex folder:', jobFlexError);
                  } else if (jobFlexFolder) {
                     // Determine which UUID to use based on job type
                     if (jobData.job_type === 'dryhire') {
                        fetchedUuid = jobFlexFolder.element_id || null;
                        console.log('Dry hire job: Using element_id:', fetchedUuid);
                     } else {
                        // For other job types, prefer parent_id, fallback to element_id
                        fetchedUuid = jobFlexFolder.parent_id || jobFlexFolder.element_id || null;
                        console.log('Non-dry hire job: Using parent_id or element_id:', fetchedUuid);
                     }
                  }
              }
           }
        }

       setFlexUuid(fetchedUuid);

     } catch (error) {
       console.error('Error fetching flex UUID on context menu open:', error);
       toast.error('Failed to get Flex link.');
       setFlexUuid(null);
     } finally {
       setIsLoadingFlexUuid(false);
     }
  };


  const handleFlexClick = () => {
    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
    } else if (!isLoadingFlexUuid) {
       // If UUID is not yet fetched and not loading, try fetching again (should be rare if fetch on context menu open works)
       fetchFlexUuid();
    } else {
       // If loading, do nothing or show a loading indicator
       toast.info('Fetching Flex link...');
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
         onContextMenu={(e) => {
            // Trigger fetching the UUID when the context menu is opened
            // Removed e.preventDefault() to allow the context menu to open
            fetchFlexUuid();
         }}
         onClick={() => {
            // Also trigger fetch on click, in case context menu is opened via click on some devices
            fetchFlexUuid();
         }}
      >
         {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => handleSetDateType('travel')} className="flex items-center gap-2">
          <Plane className="h-4 w-4" /> Travel
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleSetDateType('setup')} className="flex items-center gap-2">
          <Wrench className="h-4 w-4" /> Setup
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleSetDateType('show')} className="flex items-center gap-2">
          <Star className="h-4 w-4" /> Show
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleSetDateType('rehearsal')} className="flex items-center gap-2">
          <Mic className="h-4 w-4" /> Rehearsal
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleSetDateType('off')} className="flex items-center gap-2">
          <Moon className="h-4 w-4" /> Off
        </ContextMenuItem>
        {jobId && ( // Conditionally render Flex option if jobId exists
          <ContextMenuItem onClick={handleFlexClick} className="flex items-center gap-2" disabled={isLoadingFlexUuid}>
            {isLoadingFlexUuid ? 'Loading Flex...' : 'Flex'}
             {isLoadingFlexUuid && <Loader2 className="h-4 w-4 animate-spin ml-2" />} {/* Add loading indicator */}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
