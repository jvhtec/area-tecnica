
import React, { createContext, useContext } from 'react';
import { formatToLocalTime, convertToUTC, convertToLocalTime, getUserTimezone, createLocalDate } from '@/utils/timezone';

interface TimezoneContextType {
  userTimezone: string;
  convertToUTC: (date: Date | string) => Date;
  convertToLocal: (date: Date | string) => Date;
  formatDate: (date: Date | string | null, format?: string) => string;
  createDate: (isoString?: string) => Date;
}

const TimezoneContext = createContext<TimezoneContextType>({
  userTimezone: 'Europe/Madrid',
  convertToUTC: (date: Date | string) => new Date(),
  convertToLocal: (date: Date | string) => new Date(),
  formatDate: () => '',
  createDate: () => new Date(),
});

export const TimezoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userTimezone = getUserTimezone();

  const value = {
    userTimezone,
    convertToUTC: (date: Date | string) => convertToUTC(date, userTimezone),
    convertToLocal: (date: Date | string) => convertToLocalTime(date, userTimezone),
    formatDate: (date: Date | string | null, format?: string) => formatToLocalTime(date, format),
    createDate: (isoString?: string) => createLocalDate(isoString),
  };

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};

