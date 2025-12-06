import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, FileEdit } from 'lucide-react';
import { expenseCopy } from './expenseCopy';

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

interface ExpenseStatusBadgeProps {
  status: ExpenseStatus;
  className?: string;
}

export const ExpenseStatusBadge: React.FC<ExpenseStatusBadgeProps> = ({
  status,
  className,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'draft':
        return {
          label: expenseCopy.status.draft,
          variant: 'secondary' as const,
          icon: FileEdit,
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
      case 'submitted':
        return {
          label: expenseCopy.status.submitted,
          variant: 'default' as const,
          icon: Clock,
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        };
      case 'approved':
        return {
          label: expenseCopy.status.approved,
          variant: 'outline' as const,
          icon: CheckCircle2,
          className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
        };
      case 'rejected':
        return {
          label: expenseCopy.status.rejected,
          variant: 'destructive' as const,
          icon: XCircle,
          className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
        };
      default:
        return {
          label: status,
          variant: 'secondary' as const,
          icon: Clock,
          className: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`${config.className} ${className || ''}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};
