import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileJobCardProps {
  job: any;
  onClick?: () => void;
  isHighlighted?: boolean;
}

/**
 * Condensed mobile-friendly job card for project management
 * Displays essential job information in a compact format
 */
export function MobileJobCard({ job, onClick, isHighlighted = false }: MobileJobCardProps) {
  const startDate = new Date(job.start_time);
  const endDate = new Date(job.end_time);
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmado':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'tentativa':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'cancelado':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'completado':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]',
        isHighlighted && 'ring-2 ring-primary ring-offset-2 shadow-lg'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3 min-h-[180px] flex flex-col">
        {/* Header with title and status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base line-clamp-2 flex-1">
            {job.title}
          </h3>
          <Badge 
            variant="secondary" 
            className={cn('shrink-0 text-xs', getStatusColor(job.status))}
          >
            {job.status || 'Active'}
          </Badge>
        </div>

        {/* Client name if available */}
        {job.client && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {job.client}
          </p>
        )}

        {/* Date and time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="line-clamp-1">
            {format(startDate, 'PP', { locale: es })}
            {startDate.toDateString() !== endDate.toDateString() && (
              <> - {format(endDate, 'PP', { locale: es })}</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
          </span>
        </div>

        {/* Location */}
        {job.location?.name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1">{job.location.name}</span>
          </div>
        )}

        {/* Assignment count */}
        {job.job_assignments && job.job_assignments.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              {job.job_assignments.length} technician{job.job_assignments.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Job type badge */}
        {job.job_type && (
          <Badge variant="outline" className="text-xs capitalize">
            {job.job_type}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
