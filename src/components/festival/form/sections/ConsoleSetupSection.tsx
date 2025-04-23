
import { ConsoleConfig } from "@/components/festival/gear-setup/ConsoleConfig";
import { SectionProps } from "@/types/festival-form";
import { ConsoleSetup } from "@/types/festival";

export const ConsoleSetupSection = ({ formData, onChange, gearSetup }: SectionProps) => {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Console Setup</h3>
      <div className="grid grid-cols-1 gap-6">
        {/* FOH Console */}
        <ConsoleConfig
          consoles={formData.foh_consoles || []}
          onChange={(consoles) => onChange({ foh_consoles: consoles })}
          label="FOH Consoles"
        />

        {/* Monitor Console */}
        <ConsoleConfig
          consoles={formData.mon_consoles || []}
          onChange={(consoles) => onChange({ mon_consoles: consoles })}
          label="Monitor Consoles"
        />
      </div>
    </div>
  );
};
