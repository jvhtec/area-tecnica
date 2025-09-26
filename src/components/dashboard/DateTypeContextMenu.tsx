
import { useEffect, useState } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Plane, Wrench, Star, Moon, Mic, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format, startOfDay } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useTableSubscription } from "@/hooks/useTableSubscription";
import { useFlexUuidLazy } from "@/hooks/useFlexUuidLazy";

interface DateTypeContextMenuProps {
  children: React.ReactNode;
  jobId: string;
  date: Date;
  onTypeChange: () => void;
}

export const DateTypeContextMenu = ({ children, jobId, date, onTypeChange }: DateTypeContextMenuProps) => {
  const queryClient = useQueryClient();
  const { uuid: flexUuid, isLoading: isLoadingFlexUuid, error: flexError, hasChecked, fetchFlexUuid } = useFlexUuidLazy();

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

      // Optimistically update a local cache key (kept minimal)
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

      // Invalidate all date-types queries so CalendarSection refreshes icons
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'date-types'
      });

      toast({
        title: "Success",
        description: `Date type set to ${type}`,
      });
      onTypeChange();
    } catch (error: any) {
      console.error('Error setting date type:', error);
      toast({
        title: "Error",
        description: "Failed to set date type",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['job-date-types', jobId] });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'date-types'
      });
    }
  };

  const handleFlexClick = async () => {
    // If we haven't checked yet, fetch the UUID first
    if (!hasChecked) {
      await fetchFlexUuid(jobId);
      return;
    }

    if (isLoadingFlexUuid) {
      toast({
        title: "Loading",
        description: "Please wait while we load the Flex folder...",
      });
      return;
    }

    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
    } else if (flexError) {
      toast({
        title: "Error",
        description: flexError,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Info",
        description: "Flex folder not available for this job",
      });
    }
  };

  const getFlexMenuText = () => {
    if (!hasChecked) return "Check Flex";
    if (isLoadingFlexUuid) return "Loading Flex...";
    if (flexUuid) return "Open Flex";
    return "Flex";
  };

  const getFlexIcon = () => {
    if (isLoadingFlexUuid) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    return <ExternalLink className="h-4 w-4" />;
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent 
        collisionPadding={8} 
        className="w-48"
        alignOffset={-10}
        avoidCollisions={true}
      >
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
          <ContextMenuItem 
            onClick={handleFlexClick} 
            className="flex items-center gap-2"
            disabled={isLoadingFlexUuid}
          >
            {getFlexIcon()}
            {getFlexMenuText()}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
