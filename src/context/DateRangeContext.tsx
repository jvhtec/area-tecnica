
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { addWeeks, addMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getStartOfDay, getEndOfDay } from '@/lib/date-utils';

type DateRangeType = '1day' | '1week' | '2weeks' | '1month' | '3months' | 'custom';

interface DateRangeContextType {
  startDate: Date;
  endDate: Date;
  rangeType: DateRangeType;
  setRangeType: (type: DateRangeType) => void;
  setCustomDateRange: (start: Date, end: Date) => void;
  setBaseDate: (date: Date) => void;
  baseDate: Date;
}

const DateRangeContext = createContext<DateRangeContextType>({
  startDate: new Date(),
  endDate: new Date(),
  rangeType: '1week',
  setRangeType: () => {},
  setCustomDateRange: () => {},
  setBaseDate: () => {},
  baseDate: new Date()
});

export const useDateRange = () => useContext(DateRangeContext);

interface DateRangeProviderProps {
  children: React.ReactNode;
  initialRangeType?: DateRangeType;
  initialBaseDate?: Date;
}

export const DateRangeProvider: React.FC<DateRangeProviderProps> = ({ 
  children, 
  initialRangeType = '1week',
  initialBaseDate = new Date() 
}) => {
  const [rangeType, setRangeType] = useState<DateRangeType>(initialRangeType);
  const [baseDate, setBaseDate] = useState<Date>(startOfDay(initialBaseDate));
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });
  
  // Calculate date range based on type and base date
  const { startDate, endDate } = useMemo(() => {
    if (rangeType === 'custom' && customDateRange.start && customDateRange.end) {
      return {
        startDate: getStartOfDay(customDateRange.start),
        endDate: getEndOfDay(customDateRange.end)
      };
    }
    
    switch (rangeType) {
      case '1day':
        return {
          startDate: getStartOfDay(baseDate),
          endDate: getEndOfDay(baseDate)
        };
      case '1week':
        return {
          startDate: startOfWeek(baseDate),
          endDate: endOfWeek(baseDate)
        };
      case '2weeks':
        return {
          startDate: startOfWeek(baseDate),
          endDate: endOfWeek(addWeeks(baseDate, 1))
        };
      case '1month':
        return {
          startDate: startOfMonth(baseDate),
          endDate: endOfMonth(baseDate)
        };
      case '3months':
        return {
          startDate: startOfMonth(baseDate),
          endDate: endOfMonth(addMonths(baseDate, 2))
        };
      default:
        return {
          startDate: getStartOfDay(baseDate),
          endDate: getEndOfDay(addWeeks(baseDate, 1))
        };
    }
  }, [rangeType, baseDate, customDateRange]);
  
  // Handler for setting custom date range
  const handleSetCustomDateRange = useCallback((start: Date, end: Date) => {
    setCustomDateRange({ start, end });
    setRangeType('custom');
  }, []);
  
  const value = {
    startDate,
    endDate,
    rangeType,
    setRangeType,
    setCustomDateRange: handleSetCustomDateRange,
    setBaseDate,
    baseDate
  };
  
  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
};
