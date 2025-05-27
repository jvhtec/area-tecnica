import { useState } from "react";

export const useTourDates = () => {
  const [dates, setDates] = useState<{ date: string; location: string }[]>([
    { date: "", location: "" },
  ]);

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
    handleAddDate,
    handleRemoveDate,
    handleDateChange,
  };
};
