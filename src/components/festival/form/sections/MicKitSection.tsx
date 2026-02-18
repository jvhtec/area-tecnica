
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderSelector } from "../shared/ProviderSelector";
import { MicrophoneListBuilder, WiredMic } from "../../gear-setup/MicrophoneListBuilder";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";

interface MicKitSectionProps {
  micKit: 'festival' | 'band' | 'mixed';
  wiredMics: WiredMic[];
  onMicKitChange: (provider: 'festival' | 'band' | 'mixed') => void;
  onWiredMicsChange: (mics: WiredMic[]) => void;
  readOnly?: boolean;
  language?: 'es' | 'en';
  festivalAvailableMics?: string[];
}

export const MicKitSection = ({
  micKit,
  wiredMics,
  onMicKitChange,
  onWiredMicsChange,
  readOnly = false,
  language = "es",
  festivalAvailableMics = [],
}: MicKitSectionProps) => {
  const { models } = useEquipmentModels();
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  // Get available wired microphone models
  const allAvailableMics = models
    .filter(model => model.category === 'wired_mics')
    .map(model => model.name);
  const normalizedFestivalMics = Array.from(
    new Set(festivalAvailableMics.map((mic) => mic?.trim()).filter(Boolean))
  ) as string[];
  const availableMics =
    micKit === "festival" || micKit === "mixed"
      ? normalizedFestivalMics
      : allAvailableMics;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tx("Kit de Micrófonos", "Microphone Kit")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProviderSelector
          value={micKit}
          onChange={onMicKitChange}
          label={tx("Proveedor del Kit de Micrófonos", "Microphone Kit Provider")}
          id="mic-kit"
          showMixed={true}
          disabled={readOnly}
          language={language}
        />

        {(micKit === 'festival' || micKit === 'mixed') && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold mb-2">
                {micKit === 'mixed'
                  ? tx("Micrófonos Cableados Proporcionados por el Festival", "Festival-Provided Wired Microphones")
                  : tx("Micrófonos Cableados Requeridos", "Required Wired Microphones")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {micKit === 'mixed'
                  ? tx(
                      "Seleccione solo los micrófonos que el festival proporcionará. La banda proporcionará cualquier micrófono adicional.",
                      "Select only the microphones that the festival will provide. The band will provide any additional microphones."
                    )
                  : tx(
                      "Seleccione los micrófonos cableados que necesita para su presentación.",
                      "Select the wired microphones needed for your performance."
                    )
                }
              </p>
              {normalizedFestivalMics.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {tx(
                    "No hay micrófonos cableados cargados en el gear setup del festival.",
                    "No wired microphones loaded in festival gear setup."
                  )}
                </p>
              )}
            </div>
            <MicrophoneListBuilder
              value={wiredMics}
              onChange={onWiredMicsChange}
              availableMics={availableMics}
              readOnly={readOnly}
              showExclusiveUse={true}
              showNotes={true}
            />
          </div>
        )}

        {micKit === 'band' && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {tx(
                "La banda proporcionará su propio kit de micrófonos.",
                "The band will provide its own microphone kit."
              )}
            </p>
          </div>
        )}

        {micKit === 'mixed' && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              {tx(
                "Configuración mixta de micrófonos: Ingrese solo los micrófonos que el festival proporcionará. La banda proporcionará cualquier micrófono adicional que necesite.",
                "Mixed microphone setup: enter only the microphones provided by the festival. The band will provide any additional microphones."
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
