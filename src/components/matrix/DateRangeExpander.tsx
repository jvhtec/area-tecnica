import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, RotateCcw, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';

interface DateRangeExpanderProps {
  canExpandBefore: boolean;
  canExpandAfter: boolean;
  onExpandBefore: () => void;
  onExpandAfter: () => void;
  onReset: () => void;
  onJumpToMonth: (year: number, month: number) => void;
  rangeInfo: {
    start: Date;
    end: Date;
    totalWeeks: number;
    totalDays: number;
    startFormatted: string;
    endFormatted: string;
    isAtMaxBefore: boolean;
    isAtMaxAfter: boolean;
  };
}

export const DateRangeExpander: React.FC<DateRangeExpanderProps> = ({
  canExpandBefore,
  canExpandAfter,
  onExpandBefore,
  onExpandAfter,
  onReset,
  onJumpToMonth,
  rangeInfo
}) => {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const months = [
    { value: 1, label: 'Jan' },
    { value: 2, label: 'Feb' },
    { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' },
    { value: 5, label: 'May' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' },
    { value: 8, label: 'Aug' },
    { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' },
    { value: 11, label: 'Nov' },
    { value: 12, label: 'Dec' }
  ];

  const handleQuickJump = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    onJumpToMonth(year, month);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-1">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Date Range:</span>
      </div>
      
      {/* Expand Before Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onExpandBefore}
        disabled={!canExpandBefore}
        className="gap-1"
        title={canExpandBefore ? 'Load 4 weeks earlier' : 'Cannot expand further back'}
      >
        <ChevronLeft className="h-3 w-3" />
        {canExpandBefore ? '+4w' : 'Max'}
      </Button>

      {/* Range Info */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {rangeInfo.totalWeeks}w ({rangeInfo.totalDays}d)
        </Badge>
        <span className="text-xs text-muted-foreground">
          {rangeInfo.startFormatted} → {rangeInfo.endFormatted}
        </span>
      </div>

      {/* Expand After Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onExpandAfter}
        disabled={!canExpandAfter}
        className="gap-1"
        title={canExpandAfter ? 'Load 4 weeks later' : 'Cannot expand further forward'}
      >
        {canExpandAfter ? '+4w' : 'Max'}
        <ChevronRight className="h-3 w-3" />
      </Button>

      {/* Quick Jump Selector */}
      <Select onValueChange={handleQuickJump}>
        <SelectTrigger className="w-20 h-8">
          <SelectValue placeholder="Jump" />
        </SelectTrigger>
        <SelectContent>
          {years.flatMap(year => (
            months.map(month => (
              <SelectItem key={`${year}-${month.value}`} value={`${year}-${month.value}`}>
                {month.label} {year}
              </SelectItem>
            ))
          ))}
        </SelectContent>
      </Select>

      {/* Reset Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="gap-1"
        title="Reset to current date with default range"
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </Button>

      {/* Max Range Indicators */}
      {(rangeInfo.isAtMaxBefore || rangeInfo.isAtMaxAfter) && (
        <Badge variant="outline" className="text-xs gap-1">
          <Maximize2 className="h-3 w-3" />
          {rangeInfo.isAtMaxBefore && rangeInfo.isAtMaxAfter ? 'Full Year' : 
           rangeInfo.isAtMaxBefore ? 'Max Past' : 'Max Future'}
        </Badge>
      )}
    </div>
  );
};
