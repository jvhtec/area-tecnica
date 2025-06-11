
import { useMemo } from 'react';
import { formatInJobTimezone, toJobTimezone, fromJobTimezone, isJobOnDate } from '@/utils/timezoneUtils';

export const useTimezone = (timezone: string = 'Europe/Madrid') => {
  return useMemo(() => ({
    formatInTimezone: (date: Date | string, formatStr: string) => 
      formatInJobTimezone(date, formatStr, timezone),
    
    toTimezone: (date: Date | string) => 
      toJobTimezone(date, timezone),
    
    fromTimezone: (date: Date) => 
      fromJobTimezone(date, timezone),
    
    isJobOnDate: (jobStart: string | Date, jobEnd: string | Date, localDate: Date) =>
      isJobOnDate(jobStart, jobEnd, localDate, timezone),
    
    timezone
  }), [timezone]);
};
