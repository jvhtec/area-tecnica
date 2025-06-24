
import { WirelessConfig } from "../../gear-setup/WirelessConfig";
import { ProviderSelector } from "../shared/ProviderSelector";
import { ArtistSectionProps } from "@/types/artist-form";

export const WirelessSetupSection = ({ formData, onChange }: ArtistSectionProps) => {
  const handleWirelessChange = (systems: any[]) => {
    console.log('WirelessSetupSection: Wireless systems changed:', systems);
    onChange({ 
      wireless_systems: systems
    });
  };

  const handleIEMChange = (systems: any[]) => {
    console.log('WirelessSetupSection: IEM systems changed:', systems);
    onChange({ 
      iem_systems: systems
    });
  };

  const handleWirelessProviderChange = (provider: string) => {
    console.log('WirelessSetupSection: Wireless provider changed:', provider);
    onChange({ wireless_provided_by: provider });
  };

  const handleIEMProviderChange = (provider: string) => {
    console.log('WirelessSetupSection: IEM provider changed:', provider);
    onChange({ iem_provided_by: provider });
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
          <ProviderSelector
            value={formData.wireless_provided_by || "festival"}
            onChange={handleWirelessProviderChange}
            label="Wireless Systems Provided By"
            id="wireless-provider"
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
          <ProviderSelector
            value={formData.iem_provided_by || "festival"}
            onChange={handleIEMProviderChange}
            label="IEM Systems Provided By"
            id="iem-provider"
          />
        </div>
      </div>
    </div>
  );
};
