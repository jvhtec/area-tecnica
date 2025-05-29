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
          .select('job_type')
          .eq('id', jobId)
          .single();

        if (!job) {
          console.log('No job found');
          return;
        }

        console.log('Job type:', job.job_type);

        let uuid: string | null = null;

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
          
          if (!mappedDepartment) {
            console.log('No department mapping found');
            return;
          }

          const { data: flexFolder, error } = await supabase
            .from('flex_folders')
            .select('element_id')
            .eq('folder_type', 'tour_department')
            .eq('department', mappedDepartment)
            .single();

          if (error) {
            console.log('Error fetching tourdate flex folder:', error);
          }

          uuid = flexFolder?.element_id || null;
          console.log('Tourdate UUID found:', uuid);
        } else {
          // For non-tourdate jobs: prefer parent_id, fallback to element_id by department
          console.log('Fetching non-tourdate flex folders for department:', profile.department);
          
          const { data: flexFolders, error } = await supabase
            .from('flex_folders')
            .select('parent_id, element_id, department')
            .eq('department', profile.department);

          if (error) {
            console.log('Error fetching non-tourdate flex folders:', error);
          }

          console.log('Non-tourdate flex folders found:', flexFolders);

          if (flexFolders && flexFolders.length > 0) {
            // First try to find a parent_id that's not null
            const folderWithParent = flexFolders.find(f => f.parent_id !== null && f.parent_id !== undefined);
            if (folderWithParent) {
              uuid = folderWithParent.parent_id;
              console.log('Using parent_id:', uuid);
            } else {
              // Fallback to element_id from department match
              const departmentFolder = flexFolders.find(f => f.department === profile.department);
              uuid = departmentFolder?.element_id || null;
              console.log('Using fallback element_id:', uuid);
            }
          } else {
            console.log('No flex folders found for department');
          }
        }

        console.log('Final UUID set:', uuid);
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