
import { ConsoleConfig } from "../../gear-setup/ConsoleConfig";
import { ConsoleSetup } from "@/types/festival";

interface FestivalConsoleSetupSectionProps {
  formData: {
    foh_consoles: ConsoleSetup[];
    mon_consoles: ConsoleSetup[];
  };
  onChange: (changes: {
    foh_consoles?: ConsoleSetup[];
    mon_consoles?: ConsoleSetup[];
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

      <ConsoleConfig
        consoles={formData.mon_consoles}
        onChange={(consoles) => onChange({ mon_consoles: consoles })}
        label="Consoles de Monitor"
      />
    </div>
  );
};
