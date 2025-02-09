import { useState } from "react";
import { Department } from "@/types/department";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTourDates } from "./useTourDates";
import { useTourDepartments } from "./useTourDepartments";
import { useTourCreationMutation } from "./useTourCreationMutation";

export const useTourCreation = (
  currentDepartment: Department,
  onSuccess: () => void
) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#7E69AB");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const { dates, handleAddDate, handleRemoveDate, handleDateChange } = useTourDates();
  const { departments, handleDepartmentChange } = useTourDepartments(currentDepartment);
  const { createTourWithDates } = useTourCreationMutation();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
  };

  const handleEndDateChange = (date: string) => {
    setEndDate(date);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the tour",
        variant: "destructive",
      });
      return;
    }

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
    handleAddDate,
    handleRemoveDate,
    handleDateChange,
    handleDepartmentChange,
    handleSubmit,
    startDate,
    endDate,
    handleStartDateChange,
    handleEndDateChange,
  };
};