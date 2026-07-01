
import { ConsoleConfig } from "../../gear-setup/ConsoleConfig";
import { ConsoleSetup } from "@/types/festival";
import { WavesModelPicker } from "../shared/WavesModelPicker";
import { EnumCheckboxGroup } from "../shared/EnumCheckboxGroup";
import type { WavesModelSelection } from "@/constants/wavesModels";
import {
  FOH_DRIVE_OPTIONS,
  CONSOLE_POSITION_OPTIONS,
  MON_CONSOLE_POSITION_OPTIONS,
  type FohDrive,
  type ConsolePosition,
  type MonConsolePosition,
} from "@/constants/consoleDrive";

interface FestivalConsoleSetupSectionProps {
  formData: {
    foh_consoles: ConsoleSetup[];
    mon_consoles: ConsoleSetup[];
    foh_drive_options?: FohDrive[];
    foh_drive_positions?: ConsolePosition[];
    mon_positions?: MonConsolePosition[];
    foh_waves_models: WavesModelSelection[];
    foh_outboard: string;
    mon_waves_models: WavesModelSelection[];
    mon_outboard: string;
  };
  onChange: (changes: {
    foh_consoles?: ConsoleSetup[];
    mon_consoles?: ConsoleSetup[];
    foh_drive_options?: FohDrive[];
    foh_drive_positions?: ConsolePosition[];
    mon_positions?: MonConsolePosition[];
    foh_waves_models?: WavesModelSelection[];
    foh_outboard?: string;
    mon_waves_models?: WavesModelSelection[];
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
      <EnumCheckboxGroup
        idPrefix="festival-foh-drive"
        label="Drive FOH soportado"
        options={FOH_DRIVE_OPTIONS}
        selected={formData.foh_drive_options || []}
        onChange={(selected) => onChange({ foh_drive_options: selected })}
        disabled={readOnly}
      />
      <EnumCheckboxGroup
        idPrefix="festival-foh-drive-position"
        label="Posiciones de drive FOH soportadas"
        options={CONSOLE_POSITION_OPTIONS}
        selected={formData.foh_drive_positions || []}
        onChange={(selected) => onChange({ foh_drive_positions: selected })}
        disabled={readOnly}
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
      <EnumCheckboxGroup
        idPrefix="festival-mon-position"
        label="Posiciones de monitores soportadas"
        options={MON_CONSOLE_POSITION_OPTIONS}
        selected={formData.mon_positions || []}
        onChange={(selected) => onChange({ mon_positions: selected })}
        disabled={readOnly}
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
