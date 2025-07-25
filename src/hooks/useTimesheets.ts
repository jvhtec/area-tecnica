import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Timesheet } from "@/types/timesheet";
import { toast } from "sonner";

export const useTimesheets = (jobId: string) => {
  console.log("useTimesheets hook called with jobId:", jobId);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchTimesheets = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      console.log("Starting fetchTimesheets for jobId:", jobId);

      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .eq("job_id", jobId)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching timesheets:", error);
        setIsError(true);
        toast.error("Failed to fetch timesheets");
        return;
      }

      // Fetch technician profiles separately
      if (data && data.length > 0) {
        const technicianIds = [...new Set(data.map(t => t.technician_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, department")
          .in("id", technicianIds);

        // Merge profile data with timesheets
        const timesheetsWithProfiles = data.map(timesheet => ({
          ...timesheet,
          technician: profiles?.find(p => p.id === timesheet.technician_id)
        }));

        console.log("Setting timesheets:", timesheetsWithProfiles);
        setTimesheets(timesheetsWithProfiles as unknown as Timesheet[]);
      } else {
        setTimesheets([]);
      }
    } catch (error) {
      console.error("Error in fetchTimesheets:", error);
      setIsError(true);
      toast.error("Failed to fetch timesheets");
    } finally {
      console.log("fetchTimesheets completed, setting loading to false");
      setIsLoading(false);
    }
  }, [jobId]);

  const autoCreateTimesheets = useCallback(async () => {
    try {
      console.log("autoCreateTimesheets started for jobId:", jobId);
      
      // Get job assignments and job details
      const { data: assignments, error: assignmentsError } = await supabase
        .from("job_assignments")
        .select("technician_id")
        .eq("job_id", jobId);

      console.log("Assignments fetched:", assignments, "Error:", assignmentsError);

      if (assignmentsError || !assignments) {
        console.error("Error fetching assignments:", assignmentsError);
        setIsLoading(false);
        return;
      }

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select(`
          start_time, 
          end_time,
          job_date_types(type, date)
        `)
        .eq("id", jobId)
        .single();

      console.log("Job fetched:", job, "Error:", jobError);

      if (jobError || !job) {
        console.error("Error fetching job:", jobError);
        setIsLoading(false);
        return;
      }

      // Generate dates between start and end
      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);
      const allDates = [];
      
      console.log("Job dates:", { start_time: job.start_time, end_time: job.end_time, startDate, endDate });
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        allDates.push(d.toISOString().split('T')[0]);
      }

      // Filter out dates that are marked as "off" or "travel"
      const dates = allDates.filter(date => {
        const dateType = job.job_date_types?.find((dt: any) => dt.date === date);
        // If no date type is defined, or if it's not "off" or "travel", include it
        return !dateType || (dateType.type !== 'off' && dateType.type !== 'travel');
      });

      console.log("Generated dates (filtered):", dates);
      console.log("Date types:", job.job_date_types);

      // Check which timesheets already exist
      const { data: existingTimesheets } = await supabase
        .from("timesheets")
        .select("technician_id, date")
        .eq("job_id", jobId);

      console.log("Existing timesheets:", existingTimesheets);

      const existingCombos = new Set(
        (existingTimesheets || []).map(t => `${t.technician_id}-${t.date}`)
      );

      console.log("Existing combos:", existingCombos);

      // Create missing timesheets
      const timesheetsToCreate = [];
      for (const assignment of assignments) {
        for (const date of dates) {
          const combo = `${assignment.technician_id}-${date}`;
          if (!existingCombos.has(combo)) {
            timesheetsToCreate.push({
              job_id: jobId,
              technician_id: assignment.technician_id,
              date: date,
              created_by: (await supabase.auth.getUser()).data.user?.id,
            });
          }
        }
      }

      console.log("Timesheets to create:", timesheetsToCreate);

      if (timesheetsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from("timesheets")
          .insert(timesheetsToCreate);

        if (insertError) {
          console.error("Error creating timesheets:", insertError);
          setIsLoading(false);
        } else {
          console.log(`Auto-created ${timesheetsToCreate.length} timesheets`);
          // Refresh the timesheets after creation
          setTimeout(() => fetchTimesheets(), 500);
        }
      } else {
        console.log("No timesheets to create, finishing loading");
        // No timesheets to create, just finish loading
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error in autoCreateTimesheets:", error);
      setIsLoading(false);
    }
  }, [jobId, fetchTimesheets]);

  useEffect(() => {
    console.log("useTimesheets useEffect triggered with jobId:", jobId);
    if (jobId && jobId.length > 0 && jobId !== "") {
      console.log("Calling fetchTimesheets only");
      fetchTimesheets();
    } else {
      console.log("jobId is empty or invalid, skipping fetch");
      setIsLoading(false);
      setTimesheets([]);
    }
  }, [jobId, fetchTimesheets]);

  const createTimesheet = async (technicianId: string, date: string) => {
    try {
      const { data, error } = await supabase
        .from("timesheets")
        .insert({
          job_id: jobId,
          technician_id: technicianId,
          date: date,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email,
            department
          )
        `)
        .single();

      if (error) {
        console.error("Error creating timesheet:", error);
        toast.error("Failed to create timesheet");
        return null;
      }

      setTimesheets(prev => [...prev, data as unknown as Timesheet]);
      toast.success("Timesheet created successfully");
      return data;
    } catch (error) {
      console.error("Error in createTimesheet:", error);
      toast.error("Failed to create timesheet");
      return null;
    }
  };

  const updateTimesheet = async (timesheetId: string, updates: Partial<Timesheet>, skipRefetch = false) => {
    try {
      const { data, error } = await supabase
        .from("timesheets")
        .update(updates)
        .eq("id", timesheetId)
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email,
            department
          )
        `)
        .single();

      if (error) {
        console.error("Error updating timesheet:", error);
        toast.error("Failed to update timesheet");
        return null;
      }

      // Only refetch if not skipping (for bulk operations)
      if (!skipRefetch) {
        await fetchTimesheets();
        toast.success("Timesheet updated successfully");
      }
      
      return data;
    } catch (error) {
      console.error("Error in updateTimesheet:", error);
      toast.error("Failed to update timesheet");
      return null;
    }
  };

  const submitTimesheet = async (timesheetId: string) => {
    return updateTimesheet(timesheetId, { status: 'submitted' });
  };

  const approveTimesheet = async (timesheetId: string) => {
    const currentUser = (await supabase.auth.getUser()).data.user;
    return updateTimesheet(timesheetId, { 
      status: 'approved',
      approved_by: currentUser?.id,
      approved_at: new Date().toISOString()
    });
  };

  const signTimesheet = async (timesheetId: string, signatureData: string) => {
    return updateTimesheet(timesheetId, {
      signature_data: signatureData,
      signed_at: new Date().toISOString()
    });
  };

  const deleteTimesheet = async (timesheetId: string) => {
    try {
      const { error } = await supabase
        .from("timesheets")
        .delete()
        .eq("id", timesheetId);

      if (error) {
        console.error("Error deleting timesheet:", error);
        toast.error("Failed to delete timesheet");
        throw error;
      }

      await fetchTimesheets();
      toast.success("Timesheet deleted successfully");
    } catch (error) {
      console.error("Error in deleteTimesheet:", error);
      toast.error("Failed to delete timesheet");
      throw error;
    }
  };

  const deleteTimesheets = async (timesheetIds: string[]) => {
    try {
      const { error } = await supabase
        .from("timesheets")
        .delete()
        .in("id", timesheetIds);

      if (error) {
        console.error("Error deleting timesheets:", error);
        toast.error("Failed to delete timesheets");
        throw error;
      }

      await fetchTimesheets();
      toast.success(`${timesheetIds.length} timesheets deleted successfully`);
    } catch (error) {
      console.error("Error in deleteTimesheets:", error);
      toast.error("Failed to delete timesheets");
      throw error;
    }
  };

  return {
    timesheets,
    isLoading,
    isError,
    refetch: fetchTimesheets,
    createTimesheet,
    updateTimesheet,
    submitTimesheet,
    approveTimesheet,
    signTimesheet,
    deleteTimesheet,
    deleteTimesheets
  };
};
