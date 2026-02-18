
import { WirelessConfig } from "@/components/festival/gear-setup/WirelessConfig";
import { ArtistSectionProps } from "@/types/artist-form";
import { WirelessSetup } from "@/types/festival";

export const ArtistWirelessSetupSection = ({ formData, onChange, gearSetup, isFieldLocked, language = "es" }: ArtistSectionProps) => {
  const locked = (field: string) => isFieldLocked?.(field) ?? false;
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  const handleWirelessChange = (systems: WirelessSetup[]) => {
    onChange({ 
      wireless_systems: systems
    });
  };

  const handleIEMChange = (systems: WirelessSetup[]) => {
    onChange({ 
      iem_systems: systems
    });
  };

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">{tx("Configuración RF y Wireless", "RF & Wireless Setup")}</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <WirelessConfig
            systems={formData.wireless_systems || []}
            onChange={handleWirelessChange}
            label={tx("Sistemas Wireless", "Wireless Systems")}
            includeQuantityTypes={true}
            festivalAvailableModels={(gearSetup?.wireless_systems || [])
              .map((system) => system?.model)
              .filter((model): model is string => Boolean(model))}
            readOnly={locked("wireless_systems")}
            language={language}
          />
        </div>
        <div className="space-y-4">
          <WirelessConfig
            systems={formData.iem_systems || []}
            onChange={handleIEMChange}
            label={tx("Sistemas IEM", "IEM Systems")}
            includeQuantityTypes={true}
            isIEM={true}
            festivalAvailableModels={(gearSetup?.iem_systems || [])
              .map((system) => system?.model)
              .filter((model): model is string => Boolean(model))}
            readOnly={locked("iem_systems")}
            language={language}
          />
        </div>
      </div>
    </div>
  );
};
