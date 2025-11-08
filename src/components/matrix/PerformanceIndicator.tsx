import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Clock, Database, Zap, RefreshCw } from 'lucide-react';

interface PerformanceIndicatorProps {
  assignmentCount: number;
  availabilityCount: number;
  cellCount: number;
  isInitialLoading: boolean;
  isFetching: boolean;
}

export const PerformanceIndicator = ({
  assignmentCount,
  availabilityCount,
  cellCount,
  isInitialLoading,
  isFetching,
}: PerformanceIndicatorProps) => {
  const getPerformanceStatus = () => {
    if (isInitialLoading) return { color: 'secondary', icon: Clock, text: 'Loading...' };
    if (isFetching) return { color: 'secondary', icon: RefreshCw, text: 'Refreshing...' };
    if (cellCount > 50000) return { color: 'destructive', icon: TrendingUp, text: 'Heavy Load' };
    if (cellCount > 10000) return { color: 'warning', icon: Zap, text: 'Optimized' };
    return { color: 'success', icon: Zap, text: 'Fast' };
  };

  const status = getPerformanceStatus();
  const Icon = status.icon;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {status.text}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <div>Matrix cells: {cellCount.toLocaleString()}</div>
              <div>Assignments: {assignmentCount.toLocaleString()}</div>
              <div>Availability records: {availabilityCount.toLocaleString()}</div>
              <div>Status: Optimized queries with batch processing</div>
            </div>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              Cached
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              Data cached for faster subsequent loads
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};