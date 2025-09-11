import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type JobStatus = "Tentativa" | "Confirmado" | "Completado" | "Cancelado";

interface JobStatusBadgeProps {
  status: JobStatus | null;
  className?: string;
}

export const JobStatusBadge = ({ status, className }: JobStatusBadgeProps) => {
  if (!status) return null;

  const getStatusConfig = (status: JobStatus) => {
    switch (status) {
      case "Tentativa":
        return {
          label: "Tentative",
          variant: "secondary" as const,
          className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        };
      case "Confirmado":
        return {
          label: "Confirmed",
          variant: "default" as const,
          className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        };
      case "Completado":
        return {
          label: "Completed",
          variant: "default" as const,
          className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        };
      case "Cancelado":
        return {
          label: "Cancelled",
          variant: "destructive" as const,
          className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        };
      default:
        return {
          label: status,
          variant: "outline" as const,
          className: ""
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
};