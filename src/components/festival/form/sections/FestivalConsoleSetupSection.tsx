
import { ConsoleConfig } from "../../gear-setup/ConsoleConfig";
import { ConsoleSetup } from "@/types/festival";
import { WavesModelPicker } from "../shared/WavesModelPicker";

interface FestivalConsoleSetupSectionProps {
  formData: {
    foh_consoles: ConsoleSetup[];
    mon_consoles: ConsoleSetup[];
    foh_waves_models: string[];
    foh_outboard: string;
    mon_waves_models: string[];
    mon_outboard: string;
  };
  onChange: (changes: {
    foh_consoles?: ConsoleSetup[];
    mon_consoles?: ConsoleSetup[];
    foh_waves_models?: string[];
    foh_outboard?: string;
    mon_waves_models?: string[];
    mon_outboard?: string;
  }) => void;
  readOnly?: boolean;
}

export const FestivalConsoleSetupSection = ({ formData, onChange, readOnly = false }: FestivalConsoleSetupSectionProps) => {
  return (
    <div className="space-y-4 md:space-y-6 border rounded-lg p-3 md:p-4">
      <h3 className="text-base md:text-lg font-semibold">Configuración de Consoles</h3>

      <ConsoleConfig
        consoles={formData.foh_consoles}
        onChange={(consoles) => onChange({ foh_consoles: consoles })}
        label="Consoles FOH"
        readOnly={readOnly}
      />
      <WavesModelPicker
        idPrefix="festival-foh-waves"
        waveModelsLabel="Servidor Waves FOH"
        outboardLabel="Outboard FOH"
        outboardPlaceholder="Ej: outboard analógico adicional"
        selectedModels={formData.foh_waves_models || []}
        outboard={formData.foh_outboard || ""}
        onModelsChange={(models) => onChange({ foh_waves_models: models })}
        onOutboardChange={(outboard) => onChange({ foh_outboard: outboard })}
        disabled={readOnly}
      />

      <ConsoleConfig
        consoles={formData.mon_consoles}
        onChange={(consoles) => onChange({ mon_consoles: consoles })}
        label="Consoles de Monitor"
        readOnly={readOnly}
      />
      <WavesModelPicker
        idPrefix="festival-mon-waves"
        waveModelsLabel="Servidor Waves MON"
        outboardLabel="Outboard MON"
        outboardPlaceholder="Ej: outboard adicional para monitores"
        selectedModels={formData.mon_waves_models || []}
        outboard={formData.mon_outboard || ""}
        onModelsChange={(models) => onChange({ mon_waves_models: models })}
        onOutboardChange={(outboard) => onChange({ mon_outboard: outboard })}
        disabled={readOnly}
      />
    </div>
  );
};
