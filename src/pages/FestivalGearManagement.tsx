import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wrench, Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { FestivalGearSetupForm } from "@/components/festival/FestivalGearSetupForm";
import { StageSelector } from "@/components/festival/gear-management/StageSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { generateStageGearPDF } from "@/utils/gearSetupPdfExport";
import { buildReadableFilename } from "@/utils/fileName";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { canManageFestivalGear } from "@/utils/permissions";
import { queryKeys } from "@/lib/react-query";
import { trackError } from "@/lib/errorTracking";
import { getErrorMessage } from "@/utils/errorMessage";
import { downloadBlobInBrowser } from "@/features/festival-management/commands";
import { festivalGearKeys } from "@/features/festival-gear/keys";
import { useFestivalStages } from "@/features/festival-gear/hooks/useFestivalStages";

const FestivalGearManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useOptimizedAuth();
  const canManageGear = canManageFestivalGear(userRole);
  const [selectedStage, setSelectedStage] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);

  const { jobTitle, isLoading, stages, customStageNumbers, addStage, isAddingStage, renameStage } =
    useFestivalStages(jobId);

  useRealtimeSubscription([
    {
      table: "jobs",
      filter: `id=eq.${jobId}`,
      queryKey: queryKeys.scope("job", jobId),
    },
    {
      table: "festival_gear_setups",
      filter: `job_id=eq.${jobId}`,
      queryKey: festivalGearKeys.all(jobId),
    },
    {
      table: "festival_stages",
      filter: `job_id=eq.${jobId}`,
      queryKey: festivalGearKeys.stages(jobId),
    },
  ]);

  const getStageName = (stageNumber: number) =>
    stages.find((stage) => stage.number === stageNumber)?.name ?? `Stage ${stageNumber}`;

  const handleSave = () => {
    toast({
      title: "Éxito",
      description: "La configuración de equipo del festival ha sido actualizada.",
    });
  };

  const handlePrintGearSetup = async () => {
    if (!jobId) return;

    setIsPrinting(true);
    try {
      const stageName = getStageName(selectedStage);
      const pdf = await generateStageGearPDF(jobId, selectedStage, stageName);
      if (!pdf || pdf.size === 0) {
        throw new Error("Generated PDF is empty");
      }

      downloadBlobInBrowser(
        pdf,
        buildReadableFilename([jobTitle || "Festival", stageName, "Dotación técnica"]),
      );
      toast({
        title: "Éxito",
        description: "Documentación de configuración de equipo generada exitosamente",
      });
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "export-gear-setup-pdf", jobId });
      toast({
        title: "Error",
        description: `Error al generar documentación: ${getErrorMessage(error, "No se pudo generar el PDF de equipamiento")}`,
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const selectedStageName = getStageName(selectedStage);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate(`/festival-management/${jobId}`)}
          className="self-start"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Gestión de Festival
        </Button>
        <div className="flex flex-col items-start md:items-end md:text-right">
          <h1 className="text-xl md:text-2xl font-bold">{jobTitle}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm md:text-base text-muted-foreground">Gestión de Equipo</p>
            <ConnectionIndicator variant="icon" />
          </div>
        </div>
      </div>

      <StageSelector
        stages={stages}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
        customStageNumbers={customStageNumbers}
        canManage={canManageGear}
        onAddStage={addStage}
        isAddingStage={isAddingStage}
        onRenameStage={renameStage}
      />

      {!isLoading && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Wrench className="h-4 w-4 md:h-5 md:w-5" />
                <span className="truncate">{selectedStageName} Gear Setup</span>
              </CardTitle>
              <Button
                onClick={handlePrintGearSetup}
                disabled={isPrinting}
                variant="outline"
                size="sm"
                className="self-start sm:self-auto"
              >
                {isPrinting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">Imprimir Configuración de Equipo</span>
                <span className="sm:hidden">Imprimir</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Alert>
                <AlertDescription className="text-sm">
                  Configura el equipo para {selectedStageName}. Esta información se utilizará cuando los
                  artistas envíen sus requerimientos técnicos.
                </AlertDescription>
              </Alert>
            </div>
            <FestivalGearSetupForm
              jobId={jobId || ""}
              stageNumber={selectedStage}
              onSave={handleSave}
              readOnly={!canManageGear}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FestivalGearManagement;
