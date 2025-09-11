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

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (isUpdating || disabled) return;

    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Status updated",
        description: `Job status changed to ${JOB_STATUS_OPTIONS.find(opt => opt.value === newStatus)?.label}`
      });

      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Error updating job status:', error);
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
        >
          <JobStatusBadge status={currentStatus} />
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {JOB_STATUS_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className="gap-2"
          >
            <JobStatusBadge status={option.value} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};