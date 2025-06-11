
import { WirelessConfig } from "../../gear-setup/WirelessConfig";
import { SectionProps } from "@/types/festival-form";
import { WirelessSystem, IEMSystem } from "@/types/festival-equipment";

export const WirelessSetupSection = ({ formData, onChange }: SectionProps) => {
  const handleWirelessChange = (systems: WirelessSystem[]) => {
    onChange({ 
      wireless_systems: systems
    });
  };

  const handleIEMChange = (systems: IEMSystem[]) => {
    onChange({ 
      iem_systems: systems
    });
  };

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">RF & Wireless Setup</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <WirelessConfig
            systems={formData.wireless_systems || []}
            onChange={handleWirelessChange}
            label="Wireless Systems"
            includeQuantityTypes={true}
          />
        </div>
        <div className="space-y-4">
          <WirelessConfig
            systems={formData.iem_systems || []}
            onChange={handleIEMChange}
            label="IEM Systems"
            includeQuantityTypes={true}
            isIEM={true}
          />
        </div>
      </div>
    </div>
  );
};
