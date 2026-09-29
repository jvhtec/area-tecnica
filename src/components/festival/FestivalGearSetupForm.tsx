import { useState } from "react";
import { Save, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGearSetupForm } from "@/features/festival-gear/hooks/useGearSetupForm";
import { GearSetupSections } from "./gear-setup/GearSetupSections";
import { PushToFlexPullsheetDialog } from "./PushToFlexPullsheetDialog";

interface FestivalGearSetupFormProps {
  jobId: string;
  stageNumber?: number;
  onSave?: () => void;
  readOnly?: boolean;
}

export const FestivalGearSetupForm = ({
  jobId,
  stageNumber = 1,
  onSave,
  readOnly = false,
}: FestivalGearSetupFormProps) => {
  const { toast } = useToast();
  const [showPushDialog, setShowPushDialog] = useState(false);
  const isPrimaryStage = stageNumber === 1;

  const { setup, handleChange, save, isLoading, gearSetupId, globalSetup, hasStageSpecificSetup } =
    useGearSetupForm({ jobId, stageNumber, readOnly, onSave });

  const handlePushToFlex = () => {
    if (readOnly) return;
    if (!gearSetupId) {
      toast({
        title: "Configuración no guardada",
        description: "Por favor guarda la configuración de equipamiento antes de enviar a Flex.",
        variant: "destructive",
      });
      return;
    }
    setShowPushDialog(true);
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    save();
  };

  const alertText = isPrimaryStage
    ? "Está editando la configuración de stage predeterminada. Esta configuración se utilizará como predeterminada para todos los stages."
    : hasStageSpecificSetup
      ? "Este stage tiene una configuración de equipamiento personalizada que difiere de la configuración global."
      : `Este stage aún no tiene configuración de equipamiento. Cualquier cambio creará una configuración personalizada para Stage ${stageNumber}.`;

  const alertVariant = isPrimaryStage ? "default" : hasStageSpecificSetup ? "info" : "default";
  const alertBackground = isPrimaryStage ? "bg-yellow-50" : hasStageSpecificSetup ? "bg-blue-50" : "bg-gray-50";

  const submitLabel = isLoading
    ? "Guardando..."
    : isPrimaryStage
      ? "Guardar Configuración Global"
      : hasStageSpecificSetup
        ? `Actualizar Configuración de Stage ${stageNumber}`
        : `Crear Configuración Personalizada para Stage ${stageNumber}`;

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 md:space-y-8">
      <Alert variant={alertVariant} className={alertBackground}>
        <AlertDescription className="text-sm">{alertText}</AlertDescription>
      </Alert>

      <GearSetupSections
        jobId={jobId}
        stageNumber={stageNumber}
        setup={setup}
        onChange={handleChange}
        globalSetup={globalSetup}
        readOnly={readOnly}
      />

      {readOnly ? (
        <Alert>
          <AlertDescription className="text-sm">
            Solo lectura: no tienes permisos para modificar la configuración de equipo.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePushToFlex}
            disabled={!gearSetupId || isLoading}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Push to Flex Pullsheet
          </Button>

          <Button type="submit" disabled={isLoading} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {submitLabel}
          </Button>
        </div>
      )}

      <PushToFlexPullsheetDialog
        open={showPushDialog}
        onOpenChange={setShowPushDialog}
        gearSetup={setup}
        jobId={jobId}
      />
    </form>
  );
};
