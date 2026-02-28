
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateType, isSingleDayDateType } from "@/constants/dateTypes";

export const useTourDates = (tourId?: string) => {
  const [dates, setDates] = useState<{ 
    date: string; 
    location: string; 
    tourDateType: DateType;
    startDate: string;
    endDate: string;
  }[]>([
    { date: "", location: "", tourDateType: 'show', startDate: "", endDate: "" },
  ]);
  const queryClient = useQueryClient();

  // Query for fetching tour dates
  const { data: tourDates = [], isLoading } = useQuery({
    queryKey: ['tour-dates', tourId],
    queryFn: async () => {
      if (!tourId) return [];
      
      const { data, error } = await supabase
        .from('tour_dates')
        .select(`
          id,
          date,
          start_date,
          end_date,
          tour_date_type,
          rehearsal_days,
          location:locations(*)
        `)
        .eq('tour_id', tourId)
        .order('date');

      if (error) throw error;
      return data || [];
    },
    enabled: !!tourId
  });

  // Mutation for deleting tour dates
  const { mutateAsync: deleteTourDate, isPending: isDeleting } = useMutation({
    mutationFn: async (dateId: string) => {
      const { error } = await supabase
        .from('tour_dates')
        .delete()
        .eq('id', dateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-dates', tourId] });
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['my-tours'] });
    }
  });

  const handleAddDate = () => {
    const newDates = [...dates, { 
      date: "", 
      location: "", 
      tourDateType: 'show' as const,
      startDate: "",
      endDate: ""
    }];
    newDates.sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
    setDates(newDates);
  };

  const handleRemoveDate = (index: number) => {
    if (dates.length > 1) {
      const newDates = dates.filter((_, i) => i !== index);
      setDates(newDates);
    }
  };

  const handleDateChange = (
    index: number,
    field: "date" | "location" | "tourDateType" | "startDate" | "endDate",
    value: string
  ) => {
    const newDates = [...dates];
    newDates[index] = { ...newDates[index], [field]: value };
    
    // Auto-populate single date fields for backward compatibility
    if (field === "startDate") {
      newDates[index].date = value;
      if (!newDates[index].endDate || isSingleDayDateType(newDates[index].tourDateType)) {
        newDates[index].endDate = value;
      }
    }

    if (field === "tourDateType" && isSingleDayDateType(value as DateType)) {
      newDates[index].endDate = newDates[index].startDate || newDates[index].date || "";
    }
    
    // Sort by start date
    if (field === "startDate" || field === "date") {
      newDates.sort((a, b) => {
        const dateA = a.startDate || a.date;
        const dateB = b.startDate || b.date;
        if (!dateA || !dateB) return 0;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    }
    setDates(newDates);
  };

  return {
    dates,
    tourDates,
    isLoading,
    deleteTourDate,
    isDeleting,
    handleAddDate,
    handleRemoveDate,
    handleDateChange,
  };
};
