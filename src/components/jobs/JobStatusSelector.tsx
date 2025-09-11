import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { JobStatusBadge } from "./JobStatusBadge";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type JobStatus = "Tentativa" | "Confirmado" | "Completado" | "Cancelado";

interface JobStatusSelectorProps {
  jobId: string;
  currentStatus: JobStatus | null;
  onStatusChange?: (status: JobStatus) => void;
  disabled?: boolean;
}

const JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "Tentativa", label: "Tentative" },
  { value: "Confirmado", label: "Confirmed" },
  { value: "Completado", label: "Completed" },
  { value: "Cancelado", label: "Cancelled" }
];

export const JobStatusSelector = ({ 
  jobId, 
  currentStatus, 
  onStatusChange, 
  disabled = false 
}: JobStatusSelectorProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (isUpdating || disabled) return;

    setIsUpdating(true);
    
    // Optimistic update - call the callback immediately for instant UI feedback
    onStatusChange?.(newStatus);
    
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      // Invalidate and refetch job queries to trigger realtime updates
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-jobs'] });
      
      toast({
        title: "Status updated",
        description: `Job status changed to ${JOB_STATUS_OPTIONS.find(opt => opt.value === newStatus)?.label}`
      });

    } catch (error) {
      console.error('Error updating job status:', error);
      
      // Revert optimistic update on error by calling with current status
      onStatusChange?.(currentStatus);
      
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (disabled) {
    return <JobStatusBadge status={currentStatus} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          disabled={isUpdating}
          className="h-auto p-1 gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <JobStatusBadge status={currentStatus} />
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-40"
        onClick={(e) => e.stopPropagation()}
      >
        {JOB_STATUS_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={(e) => {
              e.stopPropagation();
              handleStatusChange(option.value);
            }}
            className="gap-2"
          >
            <JobStatusBadge status={option.value} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};