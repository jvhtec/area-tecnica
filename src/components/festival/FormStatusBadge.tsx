
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FormStatusBadgeProps {
  status: string;
  className?: string;
}

export const FormStatusBadge = ({ status, className }: FormStatusBadgeProps) => {
  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', variant: 'secondary' as const };
      case 'completed':
        return { label: 'Submitted', variant: 'success' as const };
      case 'expired':
        return { label: 'Expired', variant: 'destructive' as const };
      default:
        return { label: status, variant: 'secondary' as const };
    }
  };

  const { label, variant } = getStatusDetails(status);

  return (
    <Badge variant={variant} className={cn('capitalize', className)}>
      {label}
    </Badge>
  );
};
