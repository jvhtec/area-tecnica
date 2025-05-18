
import React, { createContext, useContext, useEffect, useState } from 'react';
import { setDefaultTimezone, getDefaultTimezone } from '@/lib/date-utils';
import { useSessionManager } from './useSessionManager';

interface DateContextType {
  timezone: string;
  setTimezone: (timezone: string) => void;
  isDateContextReady: boolean;
}

const DateContext = createContext<DateContextType>({
  timezone: 'Europe/Madrid',
  setTimezone: () => {},
  isDateContextReady: false
});

export const useDateContext = () => useContext(DateContext);

interface DateProviderProps {
  children: React.ReactNode;
}

export const DateProvider: React.FC<DateProviderProps> = ({ children }) => {
  const { session } = useSessionManager();
  const [timezone, setTimezoneState] = useState<string>(getDefaultTimezone());
  const [isDateContextReady, setIsDateContextReady] = useState(false);
  
  // Set timezone based on user profile
  useEffect(() => {
    const fetchUserTimezone = async () => {
      if (!session?.user?.id) {
        setIsDateContextReady(true);
        return;
      }
      
      try {
        const { data } = await fetch('/api/user/preferences')
          .then(res => res.json());
        
        if (data?.timezone) {
          setTimezoneState(data.timezone);
          setDefaultTimezone(data.timezone);
        }
      } catch (error) {
        console.error('Error fetching user timezone:', error);
      } finally {
        setIsDateContextReady(true);
      }
    };
    
    fetchUserTimezone();
  }, [session?.user?.id]);
  
  const setTimezone = (newTimezone: string) => {
    setTimezoneState(newTimezone);
    setDefaultTimezone(newTimezone);
    
    // Persist timezone preference if user is logged in
    if (session?.user?.id) {
      fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timezone: newTimezone }),
      }).catch(error => {
        console.error('Error saving timezone preference:', error);
      });
    }
  };
  
  return (
    <DateContext.Provider value={{ timezone, setTimezone, isDateContextReady }}>
      {children}
    </DateContext.Provider>
  );
};
