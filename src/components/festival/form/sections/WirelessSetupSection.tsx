
import { WirelessConfig } from "../../gear-setup/WirelessConfig";
import { SectionProps } from "@/types/festival-form";
import { WirelessSystem, IEMSystem } from "@/types/festival-equipment";
import { ProviderSelector } from "../shared/ProviderSelector";

export const WirelessSetupSection = ({ formData, onChange }: SectionProps) => {
  const handleWirelessChange = (systems: WirelessSystem[]) => {
    onChange({ 
      wireless_systems: systems,
      wireless_provided_by: formData.wireless_provided_by 
    });
  };

  const handleIEMChange = (systems: IEMSystem[]) => {
    onChange({ 
      iem_systems: systems,
      iem_provided_by: formData.iem_provided_by 
    });
  };

  const handleWirelessProviderChange = (value: 'festival' | 'band') => {
    onChange({ wireless_provided_by: value });
  };

  const handleIEMProviderChange = (value: 'festival' | 'band') => {
    onChange({ iem_provided_by: value });
  };

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">RF & Wireless Setup</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <ProviderSelector 
            value={formData.wireless_provided_by} 
            onChange={handleWirelessProviderChange}
            label="Default Wireless System Provider"
            id="wireless-provider"
          />
          <WirelessConfig
            systems={formData.wireless_systems || []}
            onChange={handleWirelessChange}
            label="Wireless Systems"
            includeQuantityTypes={true}
            defaultProvidedBy={formData.wireless_provided_by}
          />
        </div>
        <div className="space-y-4">
          <ProviderSelector 
            value={formData.iem_provided_by} 
            onChange={handleIEMProviderChange}
            label="Default IEM System Provider"
            id="iem-provider"
          />
          <WirelessConfig
            systems={formData.iem_systems || []}
            onChange={handleIEMChange}
            label="IEM Systems"
            includeQuantityTypes={true}
            isIEM={true}
            defaultProvidedBy={formData.iem_provided_by}
          />
        </div>
      </div>
    </div>
  );
};
