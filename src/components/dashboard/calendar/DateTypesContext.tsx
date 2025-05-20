
import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface DateTypesContextType {
  dateTypes: Record<string, any>;
  setDateTypes: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  fetchDateTypes: (jobIds: string[]) => Promise<void>;
}

const DateTypesContext = createContext<DateTypesContextType | undefined>(undefined);

export const useDateTypesContext = () => {
  const context = useContext(DateTypesContext);
  if (!context) {
    throw new Error("useDateTypesContext must be used within a DateTypesProvider");
  }
  return context;
};

export const DateTypesProvider: React.FC<{ children: React.ReactNode, jobs: any[] }> = ({ 
  children,
  jobs 
}) => {
  const [dateTypes, setDateTypes] = useState<Record<string, any>>({});

  const fetchDateTypes = async (jobIds: string[]) => {
    if (!jobIds.length) return;
    
    const { data, error } = await supabase
      .from("job_date_types")
      .select("*")
      .in("job_id", jobIds);
      
    if (error) {
      console.error("Error fetching date types:", error);
      return;
    }
    
    const typesMap = data.reduce((acc: Record<string, any>, curr) => ({
      ...acc,
      [`${curr.job_id}-${curr.date}`]: curr,
    }), {});
    
    setDateTypes(typesMap);
  };

  useEffect(() => {
    if (jobs?.length) {
      fetchDateTypes(jobs.map((job: any) => job.id));
    }
  }, [jobs]);

  useEffect(() => {
    console.log("Setting up real-time subscription for date types...");
    
    const channel = supabase.channel('date-type-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_date_types'
        },
        async (payload) => {
          console.log("Date type change detected:", payload);
          if (jobs?.length) {
            fetchDateTypes(jobs.map((job: any) => job.id));
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up date type subscription...");
      supabase.removeChannel(channel);
    };
  }, [jobs]);

  return (
    <DateTypesContext.Provider value={{ dateTypes, setDateTypes, fetchDateTypes }}>
      {children}
    </DateTypesContext.Provider>
  );
};
