
import { useState } from "react";
import { Department } from "@/types/department";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

export const useTourCreation = (
  currentDepartment: Department,
  onSuccess: () => void
) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#7E69AB");
  const [departments, setDepartments] = useState<Department[]>([currentDepartment]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDepartmentChange = (dept: Department, checked: boolean) => {
    if (checked) {
      setDepartments([...departments, dept]);
    } else {
      setDepartments(departments.filter(d => d !== dept));
    }
  };

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
  };

  const handleEndDateChange = (date: string) => {
    setEndDate(date);
  };

  const createTour = async () => {
    // Create the tour with just basic info - dates are added later via TourDateManagementDialog
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .insert({
        name: title,
        description,
        color,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .select()
      .single();

    if (tourError) throw tourError;

    return tour;
  };

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

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Invalid Dates",
        description: "End date cannot be earlier than start date",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      console.log("Creating tour...");
      await createTour();
      console.log("Tour created successfully");

      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["tours"] });

      toast({
        title: "Success",
        description: "Tour created successfully. Add tour dates from the tour management dialog.",
      });

      onSuccess();
      
      // Reset form
      setTitle("");
      setDescription("");
      setColor("#7E69AB");
      setDepartments([currentDepartment]);
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
    color,
    setColor,
    departments,
    handleDepartmentChange,
    handleSubmit,
    startDate,
    endDate,
    handleStartDateChange,
    handleEndDateChange,
    isCreating,
  };
};
