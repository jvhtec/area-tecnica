import { useToast } from "@/hooks/use-toast";
import type { JobSelection } from "@/hooks/useJobSelection";
import { exportToPDF } from "@/utils/pdfExport";
import { uploadWeightReportAndCompleteTasks } from "@/features/technical-tools/weights/weightPersistence";
import { getJobTechnicalPdfFileName } from "@/utils/technicalPdfNames";
import { appendTechnicalStageToFilename, formatTechnicalStageLabel } from "@/features/technical-tools/stage/stageAllocation";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import { getRiggingPointNumbers, type SummaryRow, type Table } from "@/pages/pesos-tool/pesosToolModel";

type Options = {
  activeTables: Table[];
  selectedJob: JobSelection | null;
  selectedJobId: string;
  selectedStage: TechnicalStage | null | undefined;
};

export const usePesosPdfExport = ({ activeTables, selectedJob, selectedJobId, selectedStage }: Options) => {
  const { toast } = useToast();
  const handleExportPDF = async () => {
    if (!selectedJobId || !selectedJob) {
      toast({
        title: 'No job selected',
        description: 'Please select a job before exporting.',
        variant: 'destructive',
      });
      return;
    }

    const getMotorCountLabel = (table: Table) => {
      const motorCount = getRiggingPointNumbers(table.riggingPoints).length;
      if (motorCount > 0) return String(motorCount);
      if (table.dualMotors) return '2';
      return table.totalWeight > 0 ? '1' : 'N/A';
    };

    const summaryRows: SummaryRow[] = activeTables.map((table) => {
      const cleanName = table.name.split('(')[0].trim();
      return {
        clusterName: cleanName,
        riggingPoints: getMotorCountLabel(table),
        clusterWeight: table.totalWeight || 0,
      };
    });

    // Group tables by clusterId to handle cable picks
    const clusters = activeTables.reduce((acc, table) => {
      if (table.clusterId) {
        if (!acc[table.clusterId]) {
          acc[table.clusterId] = [];
        }
        acc[table.clusterId].push(table);
      }
      return acc;
    }, {} as Record<string, Table[]>);

    // If Cable Pick is enabled for a cluster, add one cable pick summary row per cluster
    Object.values(clusters).forEach((clusterTables) => {
      const tableWithCablePick = clusterTables.find((table) => table.cablePick);
      if (!tableWithCablePick) return;
      summaryRows.push({
        clusterName: 'CABLE PICK',
        riggingPoints: '—',
        clusterWeight: parseFloat(tableWithCablePick.cablePickWeight || "0") || 0,
      });
    });

    try {
      let logoUrl: string | undefined = undefined;
      try {
        const { fetchJobLogo } = await import('@/utils/pdf/logoUtils');
        logoUrl = await fetchJobLogo(selectedJobId);
        console.log("Logo URL for PDF:", logoUrl);
      } catch (logoError) {
        console.error("Error fetching logo:", logoError);
      }

      const stageLabel = formatTechnicalStageLabel(selectedStage);
      const reportTitle = stageLabel ? `${selectedJob.title} - ${stageLabel}` : selectedJob.title;

      const pdfBlob = await exportToPDF(
        reportTitle,
        activeTables.map((table) => ({ ...table, toolType: 'pesos' })),
        'weight',
        reportTitle,
        selectedJob?.start_time || new Date().toISOString(),
        summaryRows,
        undefined,
        undefined, // FIXED: Remove safety margin for weight reports
        logoUrl
      );

      const fileName = appendTechnicalStageToFilename(getJobTechnicalPdfFileName('sound', selectedJob.title, 'weight'), selectedStage);
      let completedTasksCount = 0;

      // Upload PDF first - only auto-complete tasks if upload succeeds
      completedTasksCount = await uploadWeightReportAndCompleteTasks({
        fileName,
        jobId: selectedJobId,
        pdfBlob,
        stage: selectedStage,
      });

      if (completedTasksCount > 0) {
        console.log(`Auto-completed ${completedTasksCount} Pesos task(s)`);
      }

      toast({
        title: 'Success',
        description: completedTasksCount > 0
          ? `PDF uploaded successfully. ${completedTasksCount} Pesos task(s) auto-completed.`
          : 'PDF has been generated and uploaded successfully.',
      });

      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to generate or upload the PDF.',
        variant: 'destructive',
      });
    }
  };

  return handleExportPDF;
};
