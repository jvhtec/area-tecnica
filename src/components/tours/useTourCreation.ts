
import { useState } from "react";
import { Department } from "@/types/department";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTourDates } from "./hooks/useTourDates";
import { useTourDepartments } from "./hooks/useTourDepartments";
import { useTourCreationMutation } from "./hooks/useTourCreationMutation";

export const useTourCreation = (
  currentDepartment: Department,
  onSuccess: () => void
) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#7E69AB");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const { dates, handleAddDate, handleRemoveDate, handleDateChange } = useTourDates();
  const { departments, handleDepartmentChange } = useTourDepartments(currentDepartment);
  const { createTourWithDates } = useTourCreationMutation();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isCreating) {
      console.log("Tour creation already in progress, ignoring submission");
      return;
    }
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the tour",
        variant: "destructive",
      });
      return;
    }

    if (!dates.every(date => date.date)) {
      toast({
        title: "Error",
        description: "Please select a date for all tour dates",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      console.log("Creating tour...");
      await createTourWithDates({
        title,
        description,
        dates,
        color,
        departments,
        startDate,
        endDate,
      });
      console.log("Tour created successfully");

      await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["tours"] });

      toast({
        title: "Success",
        description: "Tour created successfully",
      });

      onSuccess();
      
      // Reset form
      setTitle("");
      setDescription("");
      setColor("#7E69AB");
      setStartDate("");
      setEndDate("");
    } catch (error: any) {
      console.error("Error creating tour:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create tour",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return {
    title,
    setTitle,
    description,
    setDescription,
    dates,
    color,
    setColor,
    departments,
    isCreating,
    startDate,
    endDate,
    handleStartDateChange: setStartDate,
    handleEndDateChange: setEndDate,
    handleAddDate,
    handleRemoveDate,
    handleDateChange,
    handleDepartmentChange,
    handleSubmit,
  };
};
