import { useEffect, useState } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Plane, Wrench, Star, Moon, Mic, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useTableSubscription } from "@/hooks/useTableSubscription";

interface DateTypeContextMenuProps {
  children: React.ReactNode;
  jobId: string;
  date: Date;
  onTypeChange: () => void;
}

export const DateTypeContextMenu = ({ children, jobId, date, onTypeChange }: DateTypeContextMenuProps) => {
  const queryClient = useQueryClient();
  const [flexUuid, setFlexUuid] = useState<string | null>(null);

  // Use the improved subscription hook with correct parameters
  useTableSubscription('job_date_types', ['job-date-types', jobId]);

  useEffect(() => {
    const fetchFlexUuid = async () => {
      try {
        // Get current user's department
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('No user found');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', user.id)
          .single();

        if (!profile?.department) {
          console.log('No user department found');
          return;
        }

        console.log('User department:', profile.department);

        // Get job details to determine job type
        const { data: job } = await supabase
          .from('jobs')
          .select('job_type, tour_date_id')
          .eq('id', jobId)
          .single();

        if (!job) {
          console.log('No job found');
          return;
        }

        console.log('Job details:', job);

        let uuid: string | null = null;

        if (job.job_type === 'tourdate') {
          // For tourdate jobs: use tour_department folder matching user's department
          console.log('Processing tourdate job - looking for tour_department folder...');
          
          const { data: tourDeptFolder, error } = await supabase
            .from('flex_folders')
            .select('element_id')
            .eq('folder_type', 'tour_department')
            .eq('department', profile.department)
            .single();

          if (error) {
            console.log('Error fetching tour_department folder:', error);
          } else {
            uuid = tourDeptFolder?.element_id || null;
            console.log('Tour department folder UUID found:', uuid);
          }
        } else {
          // For non-tourdate jobs: prioritize job-specific, then fallback to generic
          console.log('Processing non-tourdate job...');
          
          // First try: job-specific folders
          const { data: jobSpecificFolders } = await supabase
            .from('flex_folders')
            .select('element_id, parent_id')
            .eq('job_id', jobId)
            .eq('department', profile.department);

          if (jobSpecificFolders && jobSpecificFolders.length > 0) {
            // Prefer parent_id over element_id for job-specific folders
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

        console.log('Final UUID set for job', jobId, ':', uuid);
        setFlexUuid(uuid);
      } catch (error) {
        console.error('Error fetching flex UUID:', error);
        setFlexUuid(null);
      }
    };

    fetchFlexUuid();
  }, [jobId]);

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

  const handleFlexClick = () => {
    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
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
        {flexUuid && (
          <ContextMenuItem onClick={handleFlexClick} className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" /> Flex
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
