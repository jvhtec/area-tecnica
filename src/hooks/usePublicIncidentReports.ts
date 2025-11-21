import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { generateIncidentReportPDF } from "@/utils/incident-report/pdf-generator";

export type PublicIncidentReportRow = Database["public"]["Tables"]["public_incident_reports"]["Row"];
type EquipmentRow = Database["public"]["Tables"]["equipment"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

type ProfilePreview = {
  id: string;
  first_name: string | null;
  last_name: string | null;
} | null;

export interface EnrichedPublicIncidentReport extends PublicIncidentReportRow {
  equipment?: EquipmentRow | null;
  job?: Pick<JobRow, "id" | "title" | "start_time" | "end_time" | "status"> | null;
  triaged_by_profile?: ProfilePreview;
}

interface UpdateArgs {
  report: EnrichedPublicIncidentReport;
  updates: Partial<PublicIncidentReportRow>;
  action: string;
  notes?: string | null;
}

interface AssignJobArgs {
  report: EnrichedPublicIncidentReport;
  jobId: string;
}

interface GeneratePdfArgs {
  report: EnrichedPublicIncidentReport;
}

const ensureLogArray = (value: PublicIncidentReportRow["triage_log"]): any[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    return [value];
  }
  return [];
};

export const usePublicIncidentReports = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: reports = [], isLoading } = useQuery<EnrichedPublicIncidentReport[]>({
    queryKey: ["public-incident-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_incident_reports")
        .select(`
          *,
          equipment:equipment_id (id, name, department, barcode_number, stencil_number),
          job:jobs!public_incident_reports_job_id_fkey (id, title, start_time, end_time, status),
          triaged_by_profile:profiles!public_incident_reports_triaged_by_fkey (id, first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching public incident reports", error);
        throw error;
      }

      return (data ?? []) as EnrichedPublicIncidentReport[];
    }
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["public-incident-reports"] });
  };

  const updateReportMutation = useMutation({
    mutationFn: async ({ report, updates, action, notes }: UpdateArgs) => {
      const { data: auth } = await supabase.auth.getUser();
      const entry = {
        action,
        notes: notes ?? null,
        at: new Date().toISOString(),
        user_id: auth?.user?.id ?? null,
      };
      const log = [...ensureLogArray(report.triage_log), entry];
      const payload: Partial<PublicIncidentReportRow> = {
        ...updates,
        triage_log: log,
      };

      if (updates.status && updates.status !== "pending") {
        payload.triaged_by = auth?.user?.id ?? report.triaged_by ?? null;
        payload.triaged_at = new Date().toISOString();
      }

      if (typeof updates.triage_notes !== "undefined") {
        payload.triage_notes = updates.triage_notes;
      }

      const { error } = await supabase
        .from("public_incident_reports")
        .update(payload)
        .eq("id", report.id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Reporte actualizado",
        description: "Los cambios fueron guardados correctamente.",
      });
    },
    onError: (error) => {
      console.error("Error updating public incident report", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el reporte público.",
        variant: "destructive",
      });
    }
  });

  const assignJobMutation = useMutation({
    mutationFn: async ({ report, jobId }: AssignJobArgs) => {
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("id, title, start_time, end_time, status")
        .eq("id", jobId)
        .maybeSingle();

      if (jobError || !job) {
        throw jobError ?? new Error("Trabajo no encontrado");
      }

      const { data: auth } = await supabase.auth.getUser();
      const entry = {
        action: "job_assigned",
        notes: job.title,
        at: new Date().toISOString(),
        user_id: auth?.user?.id ?? null,
      };
      const log = [...ensureLogArray(report.triage_log), entry];

      const { error } = await supabase
        .from("public_incident_reports")
        .update({
          job_id: job.id,
          job_title_snapshot: job.title,
          job_status_snapshot: job.status,
          triaged_by: auth?.user?.id ?? report.triaged_by ?? null,
          triage_log: log,
        })
        .eq("id", report.id);

      if (error) {
        throw error;
      }

      return job;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "Trabajo asignado",
        description: "El reporte fue vinculado al trabajo seleccionado.",
      });
    },
    onError: (error) => {
      console.error("Error assigning job", error);
      toast({
        title: "Error",
        description: "No se pudo asignar el trabajo.",
        variant: "destructive",
      });
    }
  });

  const generatePdfMutation = useMutation({
    mutationFn: async ({ report }: GeneratePdfArgs) => {
      if (!report.job_id) {
        throw new Error("Debes asignar un trabajo antes de generar el PDF");
      }

      const job = report.job ?? {
        id: report.job_id,
        title: report.job_title_snapshot ?? "Reporte público",
        start_time: report.metadata?.job_start ?? new Date().toISOString(),
        end_time: report.metadata?.job_end ?? new Date().toISOString(),
        status: report.job_status_snapshot ?? null,
      };

      const pdfResult = await generateIncidentReportPDF(
        {
          jobId: report.job_id,
          jobTitle: job.title,
          jobStartDate: job.start_time,
          jobEndDate: job.end_time,
          equipmentModel: report.equipment_name ?? report.equipment?.name ?? "Equipo",
          brand: report.department ?? "Departamento",
          issue: report.issue_description,
          actionsTaken: report.actions_taken ?? "Sin acciones reportadas",
          techName: report.reporter_name ?? "Reporte público",
          signature: report.signature_data,
        },
        { saveToDatabase: true, downloadLocal: false }
      );

      const { data: auth } = await supabase.auth.getUser();
      const entry = {
        action: "pdf_generated",
        notes: pdfResult.filename,
        at: new Date().toISOString(),
        user_id: auth?.user?.id ?? null,
      };
      const log = [...ensureLogArray(report.triage_log), entry];

      const { error } = await supabase
        .from("public_incident_reports")
        .update({
          status: "triaged",
          pdf_storage_path: pdfResult.storagePath ?? null,
          pdf_generated_at: new Date().toISOString(),
          triaged_by: auth?.user?.id ?? report.triaged_by ?? null,
          triaged_at: new Date().toISOString(),
          triage_log: log,
        })
        .eq("id", report.id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: "PDF generado",
        description: "El reporte fue convertido y adjuntado al trabajo.",
      });
    },
    onError: (error) => {
      console.error("Error generating incident report PDF", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo generar el PDF.",
        variant: "destructive",
      });
    }
  });

  return {
    reports,
    isLoading,
    refresh: invalidate,
    updateReport: updateReportMutation.mutateAsync,
    assignJob: assignJobMutation.mutateAsync,
    generatePdf: generatePdfMutation.mutateAsync,
    isUpdating: updateReportMutation.isPending || assignJobMutation.isPending,
    isGeneratingPdf: generatePdfMutation.isPending,
  };
};
