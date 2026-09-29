
import { WirelessConfig } from "../../gear-setup/WirelessConfig";
import { ProviderSelector } from "../shared/ProviderSelector";
import { ArtistSectionProps } from "@/types/artist-form";
import { useEffect } from "react";
import type { ProviderValue } from "@/features/festival-artists/model";
import type { IEMSystem, WirelessSystem } from "@/types/festival-equipment";

type ProviderSource = { provided_by?: ProviderValue };

/** Mixed as soon as the systems disagree; systems with no provider count as festival. */
const detectProvider = (systems: ProviderSource[]): ProviderValue => {
  const providers = new Set(systems.map((system) => system.provided_by || "festival"));
  if (providers.size > 1) return "mixed";
  return [...providers][0] ?? "festival";
};

export const WirelessSetupSection = ({ formData, onChange, readOnly = false }: ArtistSectionProps) => {
  // Auto-update provider when systems change. Only runs when systems exist -
  // otherwise a manually selected provider (e.g. "band" with no systems added
  // yet) would get overwritten back to "festival" and never get persisted.
  useEffect(() => {
    if (readOnly) return;

    const wirelessSystems = formData.wireless_systems || [];
    const iemSystems = formData.iem_systems || [];

    if (wirelessSystems.length > 0) {
      const detectedWirelessProvider = detectProvider(wirelessSystems);
      if (detectedWirelessProvider !== formData.wireless_provided_by) {
        onChange({ wireless_provided_by: detectedWirelessProvider });
      }
    }

    if (iemSystems.length > 0) {
      const detectedIEMProvider = detectProvider(iemSystems);
      if (detectedIEMProvider !== formData.iem_provided_by) {
        onChange({ iem_provided_by: detectedIEMProvider });
      }
    }
  }, [formData.wireless_systems, formData.iem_systems, readOnly]);

  const handleWirelessChange = (systems: WirelessSystem[]) => {
    onChange({ wireless_systems: systems });
  };

  const handleIEMChange = (systems: IEMSystem[]) => {
    onChange({ iem_systems: systems });
  };

  const handleWirelessProviderChange = (provider: ProviderValue) => {
    onChange({ wireless_provided_by: provider });
  };

  const handleIEMProviderChange = (provider: ProviderValue) => {
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
