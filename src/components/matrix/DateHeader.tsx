
import React from 'react';
import { format, isToday, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateHeaderProps {
  date: Date;
  width: number;
}

export const DateHeader = ({ date, width }: DateHeaderProps) => {
  const isTodayHeader = isToday(date);
  const isWeekendHeader = isWeekend(date);

  return (
    <div 
      className={cn(
        'border-r p-2 text-center text-xs font-medium bg-card',
        'flex flex-col justify-center items-center',
        {
          'bg-orange-50 border-orange-200 text-orange-700': isTodayHeader,
          'bg-gray-100 text-gray-600': isWeekendHeader && !isTodayHeader,
        }
      )}
      style={{ width }}
    >
      <div className="font-semibold">
        {format(date, 'EEE')}
      </div>
      <div className={cn('text-lg font-bold', {
        'text-orange-700': isTodayHeader
      })}>
        {format(date, 'd')}
      </div>
      <div className="text-xs text-muted-foreground">
        {format(date, 'MMM')}
      </div>
      {format(date, 'd') === '1' && (
        <div className="text-xs text-muted-foreground mt-1">
          {format(date, 'yyyy')}
        </div>
      )}
    </div>
  );
};
