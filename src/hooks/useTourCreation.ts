
import { useState } from "react";
import { Department } from "@/types/department";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { localInputToUTC } from "@/utils/timezoneUtils";

export const useTourCreation = (
  currentDepartment: Department,
  onSuccess: () => void
) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dates, setDates] = useState<{ date: string; location: string }[]>([
    { date: "", location: "" },
  ]);
  const [color, setColor] = useState("#7E69AB");
  const [departments, setDepartments] = useState<Department[]>([currentDepartment]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timezone] = useState("Europe/Madrid"); // Default timezone for tours
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const createTourWithDates = async () => {
    const validDates = dates.filter(date => date.date);
    
    if (validDates.length === 0) {
      throw new Error("At least one valid date is required");
    }

    // Sort dates chronologically
    validDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Create the tour
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .insert({
        name: title,
        description
      })
      .select()
      .single();

    if (tourError) throw tourError;

    // Convert local dates to UTC using the tour's timezone
    const startTimeUTC = localInputToUTC(`${validDates[0].date}T00:00`, timezone);
    const endTimeUTC = localInputToUTC(`${validDates[validDates.length - 1].date}T23:59`, timezone);

    // Create the main tour job
    const { data: mainTourJob, error: mainJobError } = await supabase
      .from("jobs")
      .insert({
        title,
        description,
        start_time: startTimeUTC.toISOString(),
        end_time: endTimeUTC.toISOString(),
        job_type: "tour",
        color,
        timezone,
      })
      .select()
      .single();

    if (mainJobError) throw mainJobError;

    // Create department associations for main tour job
    const mainJobDepartments = departments.map(department => ({
      job_id: mainTourJob.id,
      department
    }));

    const { error: mainDeptError } = await supabase
      .from("job_departments")
      .insert(mainJobDepartments);

    if (mainDeptError) throw mainDeptError;

    // Process each tour date
    for (const dateInfo of validDates) {
      // First get or create location
      let locationId = null;
      
      if (dateInfo.location) {
        const { data: locationData } = await supabase
          .from("locations")
          .insert({ name: dateInfo.location })
          .select()
          .single();

        if (locationData) {
          locationId = locationData.id;
        }
      }
      
      // Create tour date entry
      const { data: tourDate, error: tourDateError } = await supabase
        .from("tour_dates")
        .insert({
          tour_id: tour.id,
          date: dateInfo.date,
          location_id: locationId
        })
        .select()
        .single();

      if (tourDateError) throw tourDateError;

      // Convert date to UTC for job times
      const dayStartUTC = localInputToUTC(`${dateInfo.date}T00:00`, timezone);
      const dayEndUTC = localInputToUTC(`${dateInfo.date}T23:59`, timezone);

      // Create job for this tour date
      const { data: dateJob, error: dateJobError } = await supabase
        .from("jobs")
        .insert({
          title: `${title} (Tour Date)`,
          description,
          start_time: dayStartUTC.toISOString(),
          end_time: dayEndUTC.toISOString(),
          location_id: locationId,
          job_type: "single",
          tour_date_id: tourDate.id,
          color,
          timezone,
        })
        .select()
        .single();

      if (dateJobError) throw dateJobError;

      // Create department associations for this date's job
      const dateDepartments = departments.map(department => ({
        job_id: dateJob.id,
        department
      }));

      const { error: dateDeptError } = await supabase
        .from("job_departments")
        .insert(dateDepartments);

      if (dateDeptError) throw dateDeptError;
    }

    return tour;
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

    if (!dates.every(date => date.date)) {
      toast({
        title: "Error",
        description: "Please select a date for all tour dates",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Creating tour...");
      await createTourWithDates();
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
      setDates([{ date: "", location: "" }]);
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
