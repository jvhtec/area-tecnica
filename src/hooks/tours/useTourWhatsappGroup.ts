/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import { queryKeys } from "@/lib/react-query";
import { extractFunctionErrorMessage } from "@/utils/supabaseFunctionError";

type Options = { isManagementUser: boolean; tourDates: any[] };

export const useTourWhatsappGroup = ({ isManagementUser, tourDates }: Options) => {
  const { toast } = useToast();
  const [isWaDialogOpen, setIsWaDialogOpen] = useState(false);
  const [waSelectedDateId, setWaSelectedDateId] = useState<string | null>(null);
  const [waDepartment, setWaDepartment] = useState<'sound'|'lights'|'video'>('sound');
  const [isCreatingWaGroup, setIsCreatingWaGroup] = useState(false);

  // Check if WhatsApp group already exists for selected date/department
  // First resolve the job_id from tour_date_id
  const { data: resolvedJobId } = useQuery({
    queryKey: queryKeys.scope('tour-date-job-id', waSelectedDateId),
    enabled: !!waSelectedDateId,
    queryFn: async () => {
      if (!waSelectedDateId) return null;
      const { data, error } = await dataLayerClient.from('jobs')
        .select('id')
        .eq('tour_date_id', waSelectedDateId)
        .maybeSingle();
      if (error || !data) return null;
      return data.id;
    }
  });

  const { data: waGroup, refetch: refetchWaGroup } = useQuery({
    queryKey: queryKeys.scope('job-whatsapp-group', resolvedJobId, waDepartment, 0),
    enabled: !!resolvedJobId && !!waDepartment && isManagementUser,
    queryFn: async () => {
      if (!resolvedJobId) return null;
      const { data, error } = await dataLayerClient.from('job_whatsapp_groups')
        .select('id, wa_group_id')
        .eq('job_id', resolvedJobId)
        .eq('department', waDepartment)
        .eq('stage_number', 0)
        .maybeSingle();
      if (error) return null;
      return data;
    }
  });

  const { data: waRequest, refetch: refetchWaRequest } = useQuery({
    queryKey: queryKeys.scope('job-whatsapp-group-request', resolvedJobId, waDepartment, 0),
    enabled: !!resolvedJobId && !!waDepartment && isManagementUser,
    queryFn: async () => {
      if (!resolvedJobId) return null;
      const { data, error } = await dataLayerClient.from('job_whatsapp_group_requests')
        .select('id, created_at')
        .eq('job_id', resolvedJobId)
        .eq('department', waDepartment)
        .eq('stage_number', 0)
        .maybeSingle();
      if (error) return null;
      return data;
    }
  });

  const getSortedTourDates = () => [...tourDates].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
  );

  const openWaDialog = () => {
    const sorted = getSortedTourDates();
    const upcoming = sorted.find(d => new Date(d.date) >= new Date()) || sorted[0];
    setWaSelectedDateId(upcoming?.id || null);
    setIsWaDialogOpen(true);
  };

  const handleCreateWaGroup = async () => {
    try {
      if (!waSelectedDateId) {
        toast({ title: 'Selecciona una fecha', description: 'Por favor elige una fecha de gira como destino.' , variant: 'destructive'});
        return;
      }
      setIsCreatingWaGroup(true);
      // Resolve job for this tour date
      const { data: jobRow, error: jobErr } = await dataLayerClient.from('jobs')
        .select('id, title, start_time, end_time')
        .eq('tour_date_id', waSelectedDateId)
        .maybeSingle();
      if (jobErr || !jobRow) {
        toast({ title: 'No se encontró trabajo', description: 'No hay trabajo vinculado a la fecha de gira seleccionada.' , variant: 'destructive'});
        setIsCreatingWaGroup(false);
        return;
      }

      // Optional pre-check: warn about missing phones for selected department
      const { data: rows } = await dataLayerClient.from('job_assignments')
        .select('sound_role, lights_role, video_role, profiles!job_assignments_technician_id_fkey(first_name,last_name,phone)')
        .eq('job_id', jobRow.id);
      const deptKey = waDepartment === 'sound' ? 'sound_role' : waDepartment === 'lights' ? 'lights_role' : 'video_role';
      const crew = (rows || []).filter((r: any) => !!r[deptKey]);
      const missing: string[] = [];
      let validPhones = 0;
      for (const r of crew) {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        const full = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Técnico';
        const ph = (profile?.phone || '').trim();
        if (!ph) missing.push(full); else validPhones += 1;
      }
      if (validPhones === 0) {
        toast({ title: 'Sin teléfonos', description: 'No se encontraron números de teléfono válidos para el departamento seleccionado en esta fecha.', variant: 'destructive' });
        setIsCreatingWaGroup(false);
        return;
      }
      if (missing.length > 0) {
        toast({ title: 'Faltan algunos teléfonos', description: `Miembros sin teléfono: ${missing.slice(0,3).join(', ')}${missing.length>3?'…':''}` });
      }

      // Invoke the existing edge function
      const { error: fnErr } = await dataLayerClient.functions.invoke('create-whatsapp-group', {
        body: { job_id: jobRow.id, department: waDepartment, stage_number: 0 }
      });
      if (fnErr) {
        toast({ title: 'Error al crear grupo', description: await extractFunctionErrorMessage(fnErr), variant: 'destructive' });
      } else {
        toast({ title: 'Solicitado', description: 'Se solicitó la creación del grupo de WhatsApp. Se finalizará en breve.' });
        setIsWaDialogOpen(false);
      }
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || String(e), variant: 'destructive' });
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
    } finally {
      setIsCreatingWaGroup(false);
    }
  };

  const retryWhatsappGroup = async () => {
    if (!waSelectedDateId) {
      toast({ title: 'Error', description: 'Selecciona una fecha primero.', variant: 'destructive' });
      return;
    }

    setIsCreatingWaGroup(true);
    try {
      // First resolve the job_id from the tour_date_id
      const { data: jobData, error: jobError } = await dataLayerClient.from('jobs')
        .select('id')
        .eq('tour_date_id', waSelectedDateId)
        .maybeSingle();

      if (jobError || !jobData) {
        toast({
          title: 'Error',
          description: 'No se encontró el trabajo asociado a esta fecha de gira.',
          variant: 'destructive'
        });
        setIsCreatingWaGroup(false);
        return;
      }

      const jobId = jobData.id;

      // Clear the failed request using RPC function with correct job_id
      const { data: clearResult, error: clearError } = await dataLayerClient.rpc(
        'clear_whatsapp_group_request',
        { p_job_id: jobId, p_department: waDepartment, p_stage_number: 0 }
      );

      if (clearError) {
        toast({
          title: 'Error',
          description: `No se pudo limpiar la solicitud: ${clearError.message}`,
          variant: 'destructive'
        });
        setIsCreatingWaGroup(false);
        return;
      }

      const result = (clearResult ?? {}) as any;

      if (!result.success) {
        toast({
          title: 'Aviso',
          description: result.error || result.message || 'No se pudo procesar la solicitud.',
          variant: result.can_retry ? 'default' : 'destructive'
        });
        await Promise.all([refetchWaGroup(), refetchWaRequest()]);
        setIsCreatingWaGroup(false);
        return;
      }

      toast({
        title: 'Solicitud limpiada',
        description: 'Intentando crear el grupo de nuevo...'
      });

      // Await the refetch to ensure state is updated before retrying
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);

      // Call the create handler directly (no setTimeout needed)
      await handleCreateWaGroup();

    } catch (err: any) {
      toast({
        title: 'Error',
        description: `Error al reintentar: ${err.message}`,
        variant: 'destructive'
      });
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
      setIsCreatingWaGroup(false);
    }
  };

  return {
    handleCreateWaGroup,
    isCreatingWaGroup,
    isWaDialogOpen,
    openWaDialog,
    retryWhatsappGroup,
    setIsWaDialogOpen,
    setWaDepartment,
    setWaSelectedDateId,
    waDepartment,
    waGroup,
    waRequest,
    waSelectedDateId,
  };
};
