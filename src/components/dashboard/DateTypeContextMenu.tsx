
import { useEffect } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Plane, Wrench, Star, Moon, Mic } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useTableSubscription } from "@/hooks/useSubscription";

interface DateTypeContextMenuProps {
  children: React.ReactNode;
  jobId: string;
  date: Date;
  onTypeChange: () => void;
}

export const DateTypeContextMenu = ({ children, jobId, date, onTypeChange }: DateTypeContextMenuProps) => {
  const queryClient = useQueryClient();

  // Use the improved subscription hook
  useTableSubscription('job_date_types', ['job-date-types', jobId], {
    filter: `job_id=eq.${jobId}`
  });

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
      // Invalidate the query to revert to the correct state
      queryClient.invalidateQueries({ queryKey: ['job-date-types', jobId] });
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
      </ContextMenuContent>
    </ContextMenu>
  );
};
