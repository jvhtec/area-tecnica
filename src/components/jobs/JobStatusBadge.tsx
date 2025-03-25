
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useJobStatus, JobStatus } from "@/hooks/useJobStatus";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, X, Clock } from "lucide-react";

interface JobStatusBadgeProps {
  jobId: string;
  status?: JobStatus | null;
  className?: string;
  onStatusChange?: (newStatus: JobStatus) => void;
}

export function JobStatusBadge({ jobId, status, className, onStatusChange }: JobStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { updateJobStatus } = useJobStatus();

  const getStatusDetails = (status: JobStatus | null | undefined) => {
    switch (status) {
      case 'Confirmado':
        return { label: 'Confirmado', color: 'bg-green-500', icon: <Check className="h-3 w-3 mr-1" /> };
      case 'Completado':
        return { label: 'Completado', color: 'bg-blue-500', icon: <Check className="h-3 w-3 mr-1" /> };
      case 'Cancelado':
        return { label: 'Cancelado', color: 'bg-red-500', icon: <X className="h-3 w-3 mr-1" /> };
      case 'Tentativa':
      default:
        return { label: 'Tentativa', color: 'bg-amber-500', icon: <Clock className="h-3 w-3 mr-1" /> };
    }
  };

  const { label, color, icon } = getStatusDetails(status as JobStatus);

  const handleStatusChange = (newStatus: JobStatus) => {
    updateJobStatus.mutate(
      { jobId, status: newStatus },
      {
        onSuccess: () => {
          if (onStatusChange) onStatusChange(newStatus);
        }
      }
    );
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Badge
          className={cn(
            "cursor-pointer flex items-center", 
            color, 
            "text-white hover:opacity-90",
            className
          )}
        >
          {icon}
          {label}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40">
        <DropdownMenuItem onClick={() => handleStatusChange("Tentativa")}>
          <Clock className="h-4 w-4 mr-2 text-amber-500" />
          Tentativa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("Confirmado")}>
          <Check className="h-4 w-4 mr-2 text-green-500" />
          Confirmado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("Completado")}>
          <Check className="h-4 w-4 mr-2 text-blue-500" />
          Completado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("Cancelado")}>
          <X className="h-4 w-4 mr-2 text-red-500" />
          Cancelado
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
