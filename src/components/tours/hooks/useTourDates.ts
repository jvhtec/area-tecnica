
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useTourDates = (tourId?: string) => {
  const [dates, setDates] = useState<{ date: string; location: string }[]>([
    { date: "", location: "" },
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
    const newDates = [...dates, { date: "", location: "" }];
    newDates.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
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
    field: "date" | "location",
    value: string
  ) => {
    const newDates = [...dates];
    newDates[index] = { ...newDates[index], [field]: value };
    if (field === "date") {
      newDates.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
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
