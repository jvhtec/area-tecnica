import { useState } from "react";

export const useTourDates = () => {
  const [dates, setDates] = useState<{ date: string; location: string }[]>([
    { date: "", location: "" },
  ]);

  const handleAddDate = () => {
    setDates([...dates, { date: "", location: "" }]);
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
    setDates(newDates);
  };

  return {
    dates,
    handleAddDate,
    handleRemoveDate,
    handleDateChange,
  };
};