
import { WirelessConfig } from "../../gear-setup/WirelessConfig";
import { ProviderSelector } from "../shared/ProviderSelector";
import { ArtistSectionProps } from "@/types/artist-form";
import { useEffect } from "react";

export const WirelessSetupSection = ({ formData, onChange, readOnly = false }: ArtistSectionProps) => {
  // Auto-detect mixed providers for wireless systems
  const detectWirelessProvider = (systems: any[]) => {
    const providers = systems.map(system => system.provided_by || "festival");
    const uniqueProviders = [...new Set(providers)];

    if (uniqueProviders.length > 1) {
      return "mixed";
    }

    return uniqueProviders[0] || "festival";
  };

  // Auto-detect mixed providers for IEM systems
  const detectIEMProvider = (systems: any[]) => {
    const providers = systems.map(system => system.provided_by || "festival");
    const uniqueProviders = [...new Set(providers)];

    if (uniqueProviders.length > 1) {
      return "mixed";
    }

    return uniqueProviders[0] || "festival";
  };

  // Auto-update provider when systems change. Only runs when systems exist -
  // otherwise a manually selected provider (e.g. "band" with no systems added
  // yet) would get overwritten back to "festival" and never get persisted.
  useEffect(() => {
    if (readOnly) return;

    const wirelessSystems = formData.wireless_systems || [];
    const iemSystems = formData.iem_systems || [];

    if (wirelessSystems.length > 0) {
      const detectedWirelessProvider = detectWirelessProvider(wirelessSystems);
      if (detectedWirelessProvider !== formData.wireless_provided_by) {
        onChange({ wireless_provided_by: detectedWirelessProvider });
      }
    }

    if (iemSystems.length > 0) {
      const detectedIEMProvider = detectIEMProvider(iemSystems);
      if (detectedIEMProvider !== formData.iem_provided_by) {
        onChange({ iem_provided_by: detectedIEMProvider });
      }
    }
  }, [formData.wireless_systems, formData.iem_systems, readOnly]);

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
    <div className="space-y-4 border rounded-lg p-3 md:p-4">
      <h3 className="text-base md:text-lg font-semibold">Configuración RF & Wireless</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-4">
          <WirelessConfig
            systems={formData.wireless_systems || []}
            onChange={handleWirelessChange}
            label="Sistemas Wireless"
            includeQuantityTypes={true}
            readOnly={readOnly}
          />
          <ProviderSelector
            value={formData.wireless_provided_by || "festival"}
            onChange={handleWirelessProviderChange}
            label="Sistemas Wireless Proporcionados Por"
            id="wireless-provider"
            showMixed={true}
            disabled={readOnly}
          />
        </div>

        <div className="space-y-4">
          <WirelessConfig
            systems={formData.iem_systems || []}
            onChange={handleIEMChange}
            label="Sistemas IEM"
            includeQuantityTypes={true}
            isIEM={true}
            readOnly={readOnly}
          />
          <ProviderSelector
            value={formData.iem_provided_by || "festival"}
            onChange={handleIEMProviderChange}
            label="Sistemas IEM Proporcionados Por"
            id="iem-provider"
            showMixed={true}
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
};
