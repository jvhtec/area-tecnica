
import React from 'react';
import { format, isToday, isWeekend } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateHeaderProps {
  date: Date;
  width: number;
  jobs?: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
    status: string;
    _assigned_count?: number;
  }>;
}

const DateHeaderComp = ({ date, width, jobs = [] }: DateHeaderProps) => {
  const isTodayHeader = isToday(date);
  const isWeekendHeader = isWeekend(date);
  const hasJobs = jobs.length > 0;

  const getJobIndicatorColors = () => {
    if (jobs.length === 0) return [];
    
    // Get unique colors from jobs, fallback to default colors
    const colors = jobs.map(job => job.color || '#7E69AB');
    return [...new Set(colors)]; // Remove duplicates
  };

  const jobColors = getJobIndicatorColors();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div 
          className={cn(
            'border-r text-center text-xs font-medium bg-card cursor-pointer',
            'flex flex-col justify-center items-center relative transition-colors',
            'hover:bg-accent/50 flex-shrink-0',
            {
              'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300': isTodayHeader,
              'bg-muted/50 text-muted-foreground': isWeekendHeader && !isTodayHeader,
              'ring-2 ring-blue-500/30 ring-inset': hasJobs,
            }
          )}
          style={{ 
            width: `${width}px`,
            minWidth: `${width}px`,
            maxWidth: `${width}px`,
            height: '100%'
          }}
        >
          <div className="font-semibold text-xs">
            {format(date, 'EEE')}
          </div>
          <div className={cn('text-base font-bold leading-tight', {
            'text-orange-700 dark:text-orange-300': isTodayHeader
          })}>
            {format(date, 'd')}
          </div>
          <div className="text-xs text-muted-foreground leading-tight">
            {format(date, 'MMM')}
          </div>
          {format(date, 'd') === '1' && (
            <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
              {format(date, 'yyyy')}
            </div>
          )}
          
          {/* Job indicators */}
          {hasJobs && (
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
              {jobColors.slice(0, 3).map((color, index) => (
                <div
                  key={index}
                  className="w-1.5 h-1.5 rounded-full border border-white dark:border-gray-800"
                  style={{ backgroundColor: color }}
                />
              ))}
              {jobColors.length > 3 && (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 border border-white dark:border-gray-800" />
              )}
            </div>
          )}
          
          {/* Job count badge */}
          {hasJobs && (
            <div className="absolute top-0.5 right-0.5">
              <Badge variant="secondary" className="text-xs px-1 py-0 h-3 min-w-3 text-xs leading-none">
                {jobs.length}
              </Badge>
            </div>
          )}
        </div>
      </PopoverTrigger>
      
      {hasJobs && (
        <PopoverContent className="w-80" side="bottom" align="center">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">
                {format(date, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{jobs.length} job{jobs.length > 1 ? 's' : ''} scheduled</span>
              </div>
              
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-2 border rounded-lg bg-card"
                  style={{ borderLeftColor: job.color || '#7E69AB', borderLeftWidth: '3px' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{job.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(job.start_time), 'HH:mm')} - {format(new Date(job.end_time), 'HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'Cancelado' && (
                        <Badge variant="destructive" className="text-[10px]">Call these people to cancel</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};

export const DateHeader = React.memo(DateHeaderComp);
