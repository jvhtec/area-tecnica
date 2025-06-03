
import { useEffect, useState } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Plane, Wrench, Star, Moon, Mic, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useTableSubscription } from "@/hooks/useTableSubscription";
import { FlexUuidService } from "@/services/flexUuidService";

interface DateTypeContextMenuProps {
  children: React.ReactNode;
  jobId: string;
  date: Date;
  onTypeChange: () => void;
}

export const DateTypeContextMenu = ({ children, jobId, date, onTypeChange }: DateTypeContextMenuProps) => {
  const queryClient = useQueryClient();
  const [flexUuid, setFlexUuid] = useState<string | null>(null);
  const [isLoadingFlexUuid, setIsLoadingFlexUuid] = useState(false);

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

      toast.success(`Date type set to ${type}`);
      onTypeChange();
    } catch (error: any) {
      console.error('Error setting date type:', error);
      toast.error('Failed to set date type');
      queryClient.invalidateQueries({ queryKey: ['job-date-types', jobId] });
    }
  };

  const fetchFlexUuid = async () => {
    if (flexUuid || isLoadingFlexUuid || !jobId) return;

    setIsLoadingFlexUuid(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated.');
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
        return;
      }

      // Use the optimized service
      const result = await FlexUuidService.getFlexUuid(jobId, profile.department);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        setFlexUuid(result.uuid);
      }
    } catch (error) {
      console.error('Error fetching flex UUID:', error);
      toast.error('Failed to get Flex link.');
    } finally {
      setIsLoadingFlexUuid(false);
    }
  };

  const handleFlexClick = () => {
    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
    } else if (!isLoadingFlexUuid) {
      fetchFlexUuid();
    } else {
      toast.info('Fetching Flex link...');
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        onContextMenu={() => {
          fetchFlexUuid();
        }}
        onClick={() => {
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
        {jobId && (
          <ContextMenuItem onClick={handleFlexClick} className="flex items-center gap-2" disabled={isLoadingFlexUuid}>
            <ExternalLink className="h-4 w-4" />
            {isLoadingFlexUuid ? (
              <>
                Loading Flex... <Loader2 className="h-4 w-4 animate-spin ml-2" />
              </>
            ) : (
              'Flex'
            )}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
