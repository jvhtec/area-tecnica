import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Timesheet } from "@/types/timesheet";
import { toast } from "sonner";
import { RATES_QUERY_KEYS } from "@/constants/ratesQueryKeys";

export const useTimesheets = (jobId: string, opts?: { userRole?: string | null }) => {
  console.log("useTimesheets hook called with jobId:", jobId);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const queryClient = useQueryClient();

  const invalidateApprovalContext = useCallback(() => {
    if (!jobId) return;
    queryClient.invalidateQueries({ queryKey: ['job-approval-status', jobId] });
    queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.approvals });
  }, [jobId, queryClient]);

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

        // For all users (including house techs), use the RPC to get visibility-aware amounts
        const enriched = await Promise.all(
          data.map(async (t) => {
            try {
              const { data: visRow, error: visErr } = await supabase.rpc(
                'get_timesheet_with_visible_amounts',
                { _timesheet_id: t.id }
              );
              if (visErr) {
                console.warn('get_timesheet_with_visible_amounts error for', t.id, visErr);
              }
              const visible = Array.isArray(visRow) ? visRow[0] : visRow; // some clients wrap rows
              return {
                ...t,
                amount_eur: visible?.amount_eur ?? undefined,
                amount_breakdown: visible?.amount_breakdown ?? undefined,
                amount_eur_visible: visible?.amount_eur_visible ?? null,
                amount_breakdown_visible: visible?.amount_breakdown_visible ?? null,
                technician: profiles?.find(p => p.id === t.technician_id)
              } as unknown as Timesheet;
            } catch (e) {
              console.warn('RPC get_timesheet_with_visible_amounts failed for', t.id, e);
              return {
                ...t,
                amount_eur_visible: null,
                amount_breakdown_visible: null,
                technician: profiles?.find(p => p.id === t.technician_id)
              } as unknown as Timesheet;
            }
          })
        );

        console.log("Setting timesheets (with visibility):", enriched);
        setTimesheets(enriched as unknown as Timesheet[]);
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
          job_type,
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

      // Skip if this job type should not create timesheets automatically
      const jtype = String(job.job_type || '').toLowerCase();
      if (jtype === 'dryhire' || jtype === 'dry_hire' || jtype === 'tourdate') {
        console.log('Job type excludes auto timesheets:', jtype);
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
            // Let DB trigger resolve category - don't set it here to keep creation simple
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

  // Attempt auto-create exactly once per job when appropriate
  const autoCreateAttemptedFor = useRef<string | null>(null);

  useEffect(() => {
    // Only management can trigger auto-creation; avoid for technicians/house tech
    const allowAuto = opts?.userRole === 'admin' || opts?.userRole === 'management';
    if (!jobId || !allowAuto) return;
    // Only attempt once per job to avoid loops
    if (autoCreateAttemptedFor.current === jobId) return;
    // If loading finished and no timesheets found, try to backfill
    if (!isLoading && timesheets.length === 0) {
      autoCreateAttemptedFor.current = jobId;
      autoCreateTimesheets();
    }
  }, [jobId, opts?.userRole, isLoading, timesheets.length, autoCreateTimesheets]);

  useEffect(() => {
    console.log("useTimesheets useEffect triggered with jobId:", jobId);
    // If caller provided a userRole, wait until it is resolved to avoid incorrect enrichment
    if (opts && typeof opts.userRole === 'undefined') {
      console.log("userRole not resolved yet; deferring fetchTimesheets");
      return;
    }
    if (jobId && jobId.length > 0 && jobId !== "") {
      console.log("Calling fetchTimesheets only");
      fetchTimesheets();
    } else {
      console.log("jobId is empty or invalid, skipping fetch");
      setIsLoading(false);
      setTimesheets([]);
    }
  }, [jobId, fetchTimesheets, opts?.userRole]);

  const createTimesheet = async (technicianId: string, date: string, category?: 'tecnico' | 'especialista' | 'responsable') => {
    try {
      const insertData: any = {
        job_id: jobId,
        technician_id: technicianId,
        date: date,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };
      
      // Include category if provided, otherwise let DB trigger resolve it
      if (category) {
        insertData.category = category;
      }

      const { data, error } = await supabase
        .from("timesheets")
        .insert(insertData)
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
        .update(updates as any)
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

      // If time fields or category changed, recompute amount server-side
      try {
        const changedKeys = Object.keys(updates);
        if (changedKeys.some(k => ['start_time','end_time','break_minutes','category','ends_next_day'].includes(k))) {
          await supabase.rpc('compute_timesheet_amount_2025', { _timesheet_id: timesheetId, _persist: true });
        }
      } catch (e) {
        console.warn('Recompute after update failed (non-fatal):', e);
      }

      // Only refetch if not skipping (for bulk operations)
      if (!skipRefetch) {
        await fetchTimesheets();
        toast.success("Timesheet updated successfully");
        invalidateApprovalContext();
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
    // Mark as approved (manager) and recompute
    const updated = await updateTimesheet(timesheetId, {
      status: 'approved',
      approved_by_manager: true,
      approved_by: currentUser?.id,
      approved_at: new Date().toISOString()
    });
    try {
      await supabase.rpc('compute_timesheet_amount_2025', { _timesheet_id: timesheetId, _persist: true });
      await fetchTimesheets();
      invalidateApprovalContext();
    } catch (e) {
      console.warn('Recompute on approve failed (non-fatal):', e);
    }
    return updated;
  };

  const rejectTimesheet = async (timesheetId: string, reason?: string) => {
    const currentUser = (await supabase.auth.getUser()).data.user;
    const updated = await updateTimesheet(
      timesheetId,
      {
        status: 'rejected',
        approved_by_manager: false,
        approved_by: null,
        approved_at: null,
        rejected_at: new Date().toISOString(),
        rejected_by: currentUser?.id,
        rejection_reason: reason ?? null
      },
      true
    );

    if (updated) {
      await fetchTimesheets();
      toast.success('Timesheet rejected');
      invalidateApprovalContext();

      // Send push notification to technician (fire-and-forget, non-blocking)
      if (updated.job_id && updated.technician_id) {
        try {
          void supabase.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'timesheet.rejected',
              job_id: updated.job_id,
              recipient_id: updated.technician_id,
              technician_id: updated.technician_id,
              rejection_reason: reason || undefined
            }
          });
        } catch (pushErr) {
          // Non-blocking: log but don't fail the rejection
          console.warn('Failed to send timesheet rejection notification:', pushErr);
        }
      }
    }

    return updated;
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
      invalidateApprovalContext();
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
      invalidateApprovalContext();
    } catch (error) {
      console.error("Error in deleteTimesheets:", error);
      toast.error("Failed to delete timesheets");
      throw error;
    }
  };

  const recalcTimesheet = async (timesheetId: string) => {
    try {
      const { data, error } = await supabase.rpc('compute_timesheet_amount_2025', { _timesheet_id: timesheetId, _persist: true });
      if (error) {
        console.error('Error recalculating timesheet:', error);
        toast.error('Failed to recalculate amount');
        return null;
      }
      await fetchTimesheets();
      toast.success('Amount recalculated');
      return data;
    } catch (e) {
      console.error('Error in recalcTimesheet:', e);
      toast.error('Failed to recalculate amount');
      return null;
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
    rejectTimesheet,
    signTimesheet,
    deleteTimesheet,
    deleteTimesheets,
    recalcTimesheet
  };
};
