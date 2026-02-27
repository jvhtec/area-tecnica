
import { ConsoleConfig } from "../../gear-setup/ConsoleConfig";
import { ConsoleSetup } from "@/types/festival";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FestivalConsoleSetupSectionProps {
  formData: {
    foh_consoles: ConsoleSetup[];
    mon_consoles: ConsoleSetup[];
    foh_waves_outboard: string;
    mon_waves_outboard: string;
  };
  onChange: (changes: {
    foh_consoles?: ConsoleSetup[];
    mon_consoles?: ConsoleSetup[];
    foh_waves_outboard?: string;
    mon_waves_outboard?: string;
  }) => void;
}

export const FestivalConsoleSetupSection = ({ formData, onChange }: FestivalConsoleSetupSectionProps) => {
  return (
    <div className="space-y-4 md:space-y-6 border rounded-lg p-3 md:p-4">
      <h3 className="text-base md:text-lg font-semibold">Configuración de Consoles</h3>

      <ConsoleConfig
        consoles={formData.foh_consoles}
        onChange={(consoles) => onChange({ foh_consoles: consoles })}
        label="Consoles FOH"
      />
      <div className="space-y-2">
        <Label htmlFor="festival-foh-waves-outboard">Waves / Outboard FOH</Label>
        <Input
          id="festival-foh-waves-outboard"
          value={formData.foh_waves_outboard || ""}
          onChange={(event) => onChange({ foh_waves_outboard: event.target.value })}
          placeholder="Ej: Waves + outboard analógico"
        />
      </div>

      <ConsoleConfig
        consoles={formData.mon_consoles}
        onChange={(consoles) => onChange({ mon_consoles: consoles })}
        label="Consoles de Monitor"
      />
      <div className="space-y-2">
        <Label htmlFor="festival-mon-waves-outboard">Waves / Outboard MON</Label>
        <Input
          id="festival-mon-waves-outboard"
          value={formData.mon_waves_outboard || ""}
          onChange={(event) => onChange({ mon_waves_outboard: event.target.value })}
          placeholder="Ej: Plugins/FX para monitores"
        />
      </div>
    </div>
  );
};
