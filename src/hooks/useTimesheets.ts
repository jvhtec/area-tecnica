import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Timesheet } from "@/types/timesheet";
import { toast } from "sonner";

export const useTimesheets = (jobId: string) => {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchTimesheets = async () => {
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
  };

  useEffect(() => {
    if (jobId) {
      fetchTimesheets();
    }
  }, [jobId]);

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