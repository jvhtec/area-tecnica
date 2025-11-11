
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderSelector } from "../shared/ProviderSelector";
import { MicrophoneListBuilder, WiredMic } from "../../gear-setup/MicrophoneListBuilder";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";

interface MicKitSectionProps {
  micKit: 'festival' | 'band' | 'mixed';
  wiredMics: WiredMic[];
  onMicKitChange: (provider: 'festival' | 'band' | 'mixed') => void;
  onWiredMicsChange: (mics: WiredMic[]) => void;
}

export const MicKitSection = ({
  micKit,
  wiredMics,
  onMicKitChange,
  onWiredMicsChange
}: MicKitSectionProps) => {
  const { models } = useEquipmentModels();

  // Get available wired microphone models
  const availableMics = models
    .filter(model => model.category === 'wired_mics')
    .map(model => model.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kit de Micrófonos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProviderSelector
          value={micKit}
          onChange={onMicKitChange}
          label="Proveedor del Kit de Micrófonos"
          id="mic-kit"
          showMixed={true}
        />

        {(micKit === 'festival' || micKit === 'mixed') && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold mb-2">
                {micKit === 'mixed' ? "Micrófonos Cableados Proporcionados por el Festival" : "Micrófonos Cableados Requeridos"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {micKit === 'mixed'
                  ? "Seleccione solo los micrófonos que el festival proporcionará. La banda proporcionará cualquier micrófono adicional."
                  : "Seleccione los micrófonos cableados que necesita para su presentación."
                }
              </p>
            </div>
            <MicrophoneListBuilder
              value={wiredMics}
              onChange={onWiredMicsChange}
              availableMics={availableMics}
              showExclusiveUse={true}
              showNotes={true}
            />
          </div>
        )}

        {micKit === 'band' && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              La banda proporcionará su propio kit de micrófonos.
            </p>
          </div>
        )}

        {micKit === 'mixed' && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              Configuración mixta de micrófonos: Ingrese solo los micrófonos que el festival proporcionará.
              La banda proporcionará cualquier micrófono adicional que necesite.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
