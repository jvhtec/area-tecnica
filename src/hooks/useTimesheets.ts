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

      const { data, error } = await supabase
        .from("timesheets")
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email,
            department
          )
        `)
        .eq("job_id", jobId)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching timesheets:", error);
        setIsError(true);
        toast.error("Failed to fetch timesheets");
        return;
      }

      setTimesheets((data || []) as unknown as Timesheet[]);
    } catch (error) {
      console.error("Error in fetchTimesheets:", error);
      setIsError(true);
      toast.error("Failed to fetch timesheets");
    } finally {
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
        .select("start_time, end_time")
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
      const dates = [];
      
      console.log("Job dates:", { start_time: job.start_time, end_time: job.end_time, startDate, endDate });
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      console.log("Generated dates:", dates);

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
    if (jobId && jobId.length > 0) {
      console.log("Calling fetchTimesheets and autoCreateTimesheets");
      fetchTimesheets();
      autoCreateTimesheets();
    } else {
      console.log("jobId is empty or invalid, skipping fetch");
      setIsLoading(false);
    }
  }, [jobId, fetchTimesheets, autoCreateTimesheets]);

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

  const updateTimesheet = async (timesheetId: string, updates: Partial<Timesheet>) => {
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

      setTimesheets(prev => 
        prev.map(t => t.id === timesheetId ? data as unknown as Timesheet : t)
      );
      toast.success("Timesheet updated successfully");
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

  return {
    timesheets,
    isLoading,
    isError,
    refetch: fetchTimesheets,
    createTimesheet,
    updateTimesheet,
    submitTimesheet,
    approveTimesheet,
    signTimesheet
  };
};