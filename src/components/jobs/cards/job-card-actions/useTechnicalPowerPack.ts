import React from "react";
import { useQuery } from "@tanstack/react-query";

import { resolveJobLocation } from "@/components/jobs/cards/job-card-actions/jobActionFormatters";
import { useToast } from "@/hooks/use-toast";
import { createQueryKey } from "@/lib/optimized-react-query";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { getDepartmentLabel } from "@/types/department";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import {
  buildTechnicalPowerSummaryPackFilename,
  generateTechnicalPowerSummaryPack,
} from "@/utils/pdf/technicalPowerSummaryPack";
import {
  getTechnicalPowerSummaryAvailability,
  loadTechnicalPowerSummaryData,
} from "@/utils/powerSummaryData";
import {
  TECHNICAL_POWER_DEPARTMENTS,
  normalizeTechnicalPowerDepartments,
  type TechnicalPowerDepartment,
  type TechnicalPowerSummaryAvailability,
} from "@/utils/technicalPowerTypes";

type UseTechnicalPowerPackArgs = {
  job: any;
  isProjectManagementPage: boolean;
  isManagementUser: boolean;
  allowedJobType: boolean;
};

export const useTechnicalPowerPack = ({
  job,
  isProjectManagementPage,
  isManagementUser,
  allowedJobType,
}: UseTechnicalPowerPackArgs) => {
  const { toast } = useToast();
  const [isGeneratingTechnicalPowerPack, setIsGeneratingTechnicalPowerPack] = React.useState(false);
  const canGenerateTechnicalPowerPack = isProjectManagementPage && isManagementUser;
  const technicalPowerSummaryTitle = React.useMemo(
    () => job.title || job.name || job.job_name || "Trabajo",
    [job.job_name, job.name, job.title]
  );
  const technicalPowerSummaryJob = React.useMemo(() => ({
    id: job.id,
    job_type: job.job_type,
    tour_id: job.tour_id ?? null,
    tour_date_id: job.tour_date_id ?? null,
  }), [job.id, job.job_type, job.tour_date_id, job.tour_id]);

  const {
    data: requiredTechnicalPowerDepartments = [],
    isLoading: isTechnicalPowerDepartmentsLoading,
    isError: isTechnicalPowerDepartmentsError,
  } = useQuery<TechnicalPowerDepartment[]>({
    queryKey: queryKeys.custom(...createQueryKey.jobs.detail(job.id), "technical-power-job-departments"),
    enabled: canGenerateTechnicalPowerPack && allowedJobType,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("job_departments")
        .select("department")
        .eq("job_id", job.id)
        .in("department", [...TECHNICAL_POWER_DEPARTMENTS]);

      if (error) throw error;

      return normalizeTechnicalPowerDepartments(
        (data || []).map((row) => row.department)
      );
    },
  });

  const hasRequiredTechnicalPowerDepartments = requiredTechnicalPowerDepartments.length > 0;

  const {
    data: technicalPowerSummaryPreview,
    isLoading: isTechnicalPowerSummaryPreviewLoading,
    isError: isTechnicalPowerSummaryPreviewError,
  } = useQuery({
    queryKey: queryKeys.custom(...createQueryKey.jobs.detail(job.id), "technical-power-summary", job.job_type ?? null, job.tour_id ?? null, job.tour_date_id ?? null),
    enabled:
      canGenerateTechnicalPowerPack &&
      allowedJobType &&
      hasRequiredTechnicalPowerDepartments,
    staleTime: 60 * 1000,
    queryFn: async () =>
      loadTechnicalPowerSummaryData({
        job: technicalPowerSummaryJob,
        supabase: dataLayerClient,
      }),
  });

  const technicalPowerSummaryStatus = React.useMemo(
    (): TechnicalPowerSummaryAvailability => {
      if (!technicalPowerSummaryPreview) {
        return {
          ready: false,
          requiredDepartments: requiredTechnicalPowerDepartments,
          availableDepartments: [],
          missingDepartments: requiredTechnicalPowerDepartments,
        };
      }

      return getTechnicalPowerSummaryAvailability(
        technicalPowerSummaryPreview,
        requiredTechnicalPowerDepartments
      );
    },
    [requiredTechnicalPowerDepartments, technicalPowerSummaryPreview]
  );

  const hasAvailableTechnicalPowerDepartments =
    technicalPowerSummaryStatus.availableDepartments.length > 0;
  const canRetryTechnicalPowerPack =
    isTechnicalPowerDepartmentsError || isTechnicalPowerSummaryPreviewError;

  const downloadPdfBlob = React.useCallback((blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);

  const getTechnicalPowerPackTooltip = React.useCallback(() => {
    if (isGeneratingTechnicalPowerPack) {
      return "Generando resumen tecnico de potencia";
    }

    if (isTechnicalPowerDepartmentsLoading) {
      return "Comprobando departamentos tecnicos";
    }

    if (isTechnicalPowerDepartmentsError) {
      return "No se pudieron comprobar los departamentos tecnicos";
    }

    if (!hasRequiredTechnicalPowerDepartments) {
      return "Este trabajo no incluye departamentos tecnicos con resumen de potencia";
    }

    if (isTechnicalPowerSummaryPreviewLoading) {
      return "Comprobando tablas de potencia";
    }

    if (isTechnicalPowerSummaryPreviewError) {
      return "No se pudieron comprobar las tablas de potencia";
    }

    if (technicalPowerSummaryStatus.ready) {
      return "Imprimir resumen tecnico de potencia";
    }

    if (technicalPowerSummaryStatus.availableDepartments.length > 0) {
      const missingLabels = technicalPowerSummaryStatus.missingDepartments
        .map((department) => getDepartmentLabel(department))
        .join(", ");

      return `Se imprimira con los departamentos disponibles. Pueden faltar en el PDF: ${missingLabels}`;
    }

    const missingLabels = technicalPowerSummaryStatus.missingDepartments
      .map((department) => getDepartmentLabel(department))
      .join(", ");

    return `No hay tablas de potencia disponibles para imprimir. Faltan: ${missingLabels}`;
  }, [
    isGeneratingTechnicalPowerPack,
    hasRequiredTechnicalPowerDepartments,
    isTechnicalPowerDepartmentsError,
    isTechnicalPowerDepartmentsLoading,
    isTechnicalPowerSummaryPreviewError,
    isTechnicalPowerSummaryPreviewLoading,
    technicalPowerSummaryStatus,
  ]);

  const handleGenerateTechnicalPowerPack = React.useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isGeneratingTechnicalPowerPack) {
      return;
    }

    setIsGeneratingTechnicalPowerPack(true);

    try {
      const { data: freshJobDepartments, error: jobDepartmentsError } = await dataLayerClient.from("job_departments")
        .select("department")
        .eq("job_id", job.id)
        .in("department", [...TECHNICAL_POWER_DEPARTMENTS]);

      if (jobDepartmentsError) {
        throw jobDepartmentsError;
      }

      const requiredDepartments = normalizeTechnicalPowerDepartments(
        (freshJobDepartments || []).map((row) => row.department)
      );

      if (requiredDepartments.length === 0) {
        toast({
          title: "Sin departamentos tecnicos",
          description: "Este trabajo no incluye departamentos tecnicos con resumen de potencia.",
          variant: "destructive",
        });
        return;
      }

      const summary = await loadTechnicalPowerSummaryData({
        job: technicalPowerSummaryJob,
        supabase: dataLayerClient,
      });

      const summaryStatus = getTechnicalPowerSummaryAvailability(
        summary,
        requiredDepartments
      );
      if (summaryStatus.availableDepartments.length === 0) {
        const missingLabels = summaryStatus.missingDepartments
          .map((department) => getDepartmentLabel(department))
          .join(", ");

        toast({
          title: "Sin tablas de potencia",
          description: `No existen tablas de potencia disponibles para imprimir. Faltan: ${missingLabels}`,
          variant: "destructive",
        });
        return;
      }

      let logoUrl: string | undefined;
      try {
        logoUrl = await fetchJobLogo(job.id);
      } catch (logoError) {
        console.warn("[JobCardActions] Could not load job logo for technical power pack", logoError);
      }

      const pdfBlob = await generateTechnicalPowerSummaryPack({
        jobTitle: technicalPowerSummaryTitle,
        jobDate: job.start_time || job.date || null,
        jobLocation: resolveJobLocation(job),
        logoUrl,
        includedDepartments: summaryStatus.availableDepartments,
        summary,
      });

      downloadPdfBlob(pdfBlob, buildTechnicalPowerSummaryPackFilename(technicalPowerSummaryTitle));

      const missingLabels = summaryStatus.missingDepartments
        .map((department) => getDepartmentLabel(department))
        .join(", ");

      toast({
        title: summaryStatus.missingDepartments.length > 0 ? "Resumen generado parcialmente" : "Resumen generado",
        description:
          summaryStatus.missingDepartments.length > 0
            ? `El resumen tecnico de potencia se ha descargado. No incluye: ${missingLabels}.`
            : "El resumen tecnico de potencia se ha descargado correctamente.",
      });
    } catch (error: unknown) {
      console.error("[JobCardActions] Failed to generate technical power summary pack", error);
      toast({
        title: "Error al generar el resumen",
        description: error instanceof Error ? error.message : "No se pudo generar el resumen tecnico de potencia.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTechnicalPowerPack(false);
    }
  }, [
    downloadPdfBlob,
    isGeneratingTechnicalPowerPack,
    job,
    technicalPowerSummaryJob,
    technicalPowerSummaryTitle,
    toast,
  ]);

  return {
    canGenerateTechnicalPowerPack,
    canRetryTechnicalPowerPack,
    getTechnicalPowerPackTooltip,
    handleGenerateTechnicalPowerPack,
    hasAvailableTechnicalPowerDepartments,
    hasRequiredTechnicalPowerDepartments,
    isGeneratingTechnicalPowerPack,
    isTechnicalPowerDepartmentsLoading,
    isTechnicalPowerSummaryPreviewLoading,
    technicalPowerSummaryStatus,
  };
};
