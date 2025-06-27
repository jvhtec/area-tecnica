
import { WirelessConfig } from "../../gear-setup/WirelessConfig";
import { ProviderSelector } from "../shared/ProviderSelector";
import { ArtistSectionProps } from "@/types/artist-form";
import { useEffect } from "react";

export const WirelessSetupSection = ({ formData, onChange }: ArtistSectionProps) => {
  // Auto-detect mixed providers for wireless systems
  const detectWirelessProvider = (systems: any[]) => {
    if (!systems || systems.length === 0) return "festival";
    
    const providers = systems.map(system => system.provided_by || "festival");
    const uniqueProviders = [...new Set(providers)];
    
    if (uniqueProviders.length > 1) {
      return "mixed";
    }
    
    return uniqueProviders[0] || "festival";
  };

  // Auto-detect mixed providers for IEM systems
  const detectIEMProvider = (systems: any[]) => {
    if (!systems || systems.length === 0) return "festival";
    
    const providers = systems.map(system => system.provided_by || "festival");
    const uniqueProviders = [...new Set(providers)];
    
    if (uniqueProviders.length > 1) {
      return "mixed";
    }
    
    return uniqueProviders[0] || "festival";
  };

  // Auto-update provider when systems change
  useEffect(() => {
    const detectedWirelessProvider = detectWirelessProvider(formData.wireless_systems || []);
    const detectedIEMProvider = detectIEMProvider(formData.iem_systems || []);
    
    if (detectedWirelessProvider !== formData.wireless_provided_by) {
      onChange({ wireless_provided_by: detectedWirelessProvider });
    }
    
    if (detectedIEMProvider !== formData.iem_provided_by) {
      onChange({ iem_provided_by: detectedIEMProvider });
    }
  }, [formData.wireless_systems, formData.iem_systems]);

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
            showMixed={true}
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
            showMixed={true}
          />
        </div>
      </div>
    </div>
  );
};
