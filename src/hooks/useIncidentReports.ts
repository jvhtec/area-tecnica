import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface IncidentReport {
  id: string;
  job_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  job?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  };
  uploaded_by_profile?: {
    first_name: string;
    last_name: string;
  } | null;
}

export const useIncidentReports = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: reports = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["incident-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_documents")
        .select(`
          *,
          job:jobs(id, title, start_time, end_time)
        `)
        .like("file_path", "incident-reports/%")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      
      // Get unique user IDs and fetch profile data separately
      const userIds = [...new Set(data.map(report => report.uploaded_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      // Map profiles to reports
      const reportsWithProfiles = data.map(report => ({
        ...report,
        uploaded_by_profile: profiles?.find(p => p.id === report.uploaded_by) || null
      }));

      return reportsWithProfiles;
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const report = reports.find(r => r.id === reportId);
      if (!report) throw new Error("Report not found");

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("job-documents")
        .remove([report.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("job_documents")
        .delete()
        .eq("id", reportId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident-reports"] });
      toast({
        title: "Reporte eliminado",
        description: "El reporte de incidencia ha sido eliminado correctamente.",
      });
    },
    onError: (error) => {
      console.error("Error deleting incident report:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el reporte de incidencia.",
        variant: "destructive",
      });
    },
  });

  const downloadReport = async (report: IncidentReport) => {
    try {
      const { data, error } = await supabase.storage
        .from("job-documents")
        .download(report.file_path);

      if (error) throw error;

      // Create blob URL and trigger download
      const blob = new Blob([data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = report.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Descarga iniciada",
        description: "El reporte de incidencia se está descargando.",
      });
    } catch (error) {
      console.error("Error downloading report:", error);
      toast({
        title: "Error",
        description: "No se pudo descargar el reporte de incidencia.",
        variant: "destructive",
      });
    }
  };

  return {
    reports,
    isLoading,
    error,
    deleteReport: deleteReportMutation.mutate,
    isDeleting: deleteReportMutation.isPending,
    downloadReport,
  };
};