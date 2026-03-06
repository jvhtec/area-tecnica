import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { ConsoleSetupSection } from "../form/sections/ConsoleSetupSection";
import { WirelessSetupSection } from "../form/sections/WirelessSetupSection";
import { MicKitSection } from "../form/sections/MicKitSection";
import { MonitorSetupSection } from "../form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "../form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "../form/sections/InfrastructureSection";
import { NotesSection } from "../form/sections/NotesSection";
import { useCombinedGearSetup } from "@/hooks/useCombinedGearSetup";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBandOptionLabel, getBandOptionsEU, isFrequencyBandSelection } from "@/lib/frequencyBands";
import type { MobileArtistRiderFile, MobileConfigCategory } from "./MobileArtistCard";

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  foh_console: string;
  foh_console_provided_by?: string;
  mon_console: string;
  mon_console_provided_by?: string;
  monitors_from_foh?: boolean;
  foh_waves_outboard?: string;
  mon_waves_outboard?: string;
  wireless_systems: any[];
  wireless_provided_by?: string;
  iem_systems: any[];
  iem_provided_by?: string;
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  extras_wired?: string;
  notes?: string;
  rider_missing?: boolean;
  foh_tech?: boolean;
  mon_tech?: boolean;
  isaftermidnight?: boolean;
  mic_kit?: 'festival' | 'band' | 'mixed';
  wired_mics?: Array<{ model: string; quantity: number; exclusive_use?: boolean; notes?: string }>;
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  other_infrastructure?: string;
  infrastructure_provided_by?: string;
  job_id?: string;
}

interface MobileArtistConfigEditorProps {
  artist: Artist;
  category: MobileConfigCategory;
  jobId: string;
  selectedDate: string;
  onBack: () => void;
  onSaved: () => void;
}

const CATEGORY_LABELS: Record<MobileConfigCategory, { title: string; subtitle: string }> = {
  consoles: { title: "Consolas", subtitle: "FOH y Monitor" },
  wireless: { title: "Wireless / IEM", subtitle: "Micros inalámbricos y monitores in-ear" },
  microphones: { title: "Micrófonos", subtitle: "Kit de micrófonos y especificaciones" },
  monitors: { title: "Monitores y Extras", subtitle: "Cuñas, side fills, drum fills" },
  infrastructure: { title: "Infraestructura", subtitle: "Conexiones de red y audio" },
  notes: { title: "Notas de Producción", subtitle: "Notas y comentarios" },
};

const formatProviderLabel = (provider?: string | null) => {
  if (!provider) return "Sin especificar";
  if (provider === "festival") return "Festival";
  if (provider === "band") return "Artista";
  if (provider === "mixed") return "Mixto";
  return provider;
};

const formatWiredMics = (
  wiredMics?: Array<{ model: string; quantity: number; exclusive_use?: boolean; notes?: string }> | null
) => {
  if (!wiredMics || wiredMics.length === 0) return "Sin micros cableados especificados";
  return wiredMics
    .map((mic) => {
      const exclusive = mic.exclusive_use ? " (uso exclusivo)" : "";
      return `${mic.quantity}x ${mic.model}${exclusive}`;
    })
    .join(", ");
};

const formatSystems = (systems: any[] = []) => {
  if (!Array.isArray(systems) || systems.length === 0) return "Sin sistemas";
  return systems
    .map((system) => {
      const hh = Number(system.quantity_hh || 0);
      const bp = Number(system.quantity_bp || 0);
      const qty = Number(system.quantity || 0);
      const model = system.model || "Modelo";
      if (hh > 0 || bp > 0) {
        return `${model}: ${hh} HH, ${bp} BP`;
      }
      return `${model}: ${qty}`;
    })
    .join(" · ");
};

type WirelessSystemLike = {
  model?: string;
  quantity?: number;
  quantity_hh?: number;
  quantity_bp?: number;
  quantity_ch?: number;
  band?: unknown;
  provided_by?: string;
  notes?: string;
};

const formatSystemBand = (category: "wireless" | "iem", system: WirelessSystemLike) => {
  const rawBand = system.band;
  if (isFrequencyBandSelection(rawBand)) {
    return formatBandOptionLabel(rawBand);
  }

  if (typeof rawBand === "string") {
    const trimmedBand = rawBand.trim();
    if (!trimmedBand) return "Sin especificar";

    const options = getBandOptionsEU(category, system.model || "");
    const matched = options.find((option) => option.code.toLowerCase() === trimmedBand.toLowerCase());
    if (matched) return formatBandOptionLabel(matched);
    return trimmedBand;
  }

  return "Sin especificar";
};

const formatSystemQuantity = (category: "wireless" | "iem", system: WirelessSystemLike) => {
  const quantityCh = Number(system.quantity_ch || 0);
  const quantityHh = Number(system.quantity_hh || 0);
  const quantityBp = Number(system.quantity_bp || 0);
  const legacyQuantity = Number(system.quantity || 0);

  if (category === "wireless") {
    const parts = [
      quantityCh > 0 ? `Canales: ${quantityCh}` : null,
      quantityHh > 0 ? `HH: ${quantityHh}` : null,
      quantityBp > 0 ? `BP: ${quantityBp}` : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" · ");
    return legacyQuantity > 0 ? `Cantidad: ${legacyQuantity}` : "Cantidad no especificada";
  }

  const parts = [
    quantityHh > 0 ? `Canales: ${quantityHh}` : null,
    quantityBp > 0 ? `Petacas: ${quantityBp}` : null,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return legacyQuantity > 0 ? `Cantidad: ${legacyQuantity}` : "Cantidad no especificada";
};

const formatInfrastructure = (artist: Artist) => {
  const infra: string[] = [];
  if (artist.infra_cat6 && artist.infra_cat6_quantity) infra.push(`${artist.infra_cat6_quantity}x CAT6`);
  if (artist.infra_hma && artist.infra_hma_quantity) infra.push(`${artist.infra_hma_quantity}x HMA`);
  if (artist.infra_coax && artist.infra_coax_quantity) infra.push(`${artist.infra_coax_quantity}x Coax`);
  if (artist.infra_opticalcon_duo && artist.infra_opticalcon_duo_quantity) {
    infra.push(`${artist.infra_opticalcon_duo_quantity}x OpticalCON DUO`);
  }
  if (artist.infra_analog && artist.infra_analog > 0) infra.push(`${artist.infra_analog}x Analog`);
  if (artist.other_infrastructure) infra.push(artist.other_infrastructure);
  if (infra.length === 0) return "Sin infraestructura adicional";
  return infra.join(" · ");
};

export const ReadOnlyArtistCategoryContent = ({
  artist,
  category,
  riderFiles = [],
  onViewRiderFile,
  onDownloadRiderFile,
}: {
  artist: Artist;
  category: MobileConfigCategory;
  riderFiles?: MobileArtistRiderFile[];
  onViewRiderFile?: (file: MobileArtistRiderFile) => void;
  onDownloadRiderFile?: (file: MobileArtistRiderFile) => void;
}) => {
  if (category === "consoles") {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">FOH</div>
          <div className="font-medium">{artist.foh_console || "Sin especificar"}</div>
          <div className="text-muted-foreground">Proveedor: {formatProviderLabel(artist.foh_console_provided_by)}</div>
          {artist.foh_waves_outboard && (
            <div className="text-muted-foreground">Waves/Outboard: {artist.foh_waves_outboard}</div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">Monitores</div>
          {artist.monitors_from_foh ? (
            <div className="font-medium">Monitores desde FOH</div>
          ) : (
            <>
              <div className="font-medium">{artist.mon_console || "Sin especificar"}</div>
              <div className="text-muted-foreground">Proveedor: {formatProviderLabel(artist.mon_console_provided_by)}</div>
              {artist.mon_waves_outboard && (
                <div className="text-muted-foreground">Waves/Outboard: {artist.mon_waves_outboard}</div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (category === "wireless") {
    const renderSystemDetails = (systems: WirelessSystemLike[], systemCategory: "wireless" | "iem") => {
      if (!Array.isArray(systems) || systems.length === 0) {
        return <div className="text-muted-foreground">Sin sistemas</div>;
      }

      return (
        <div className="space-y-2">
          {systems.map((system, index) => (
            <div key={`${system.model || "model"}-${index}`} className="rounded-md border p-2.5 bg-muted/20 space-y-1.5">
              <div className="font-medium break-words">{system.model || "Modelo sin especificar"}</div>
              <div className="text-muted-foreground break-words">{formatSystemQuantity(systemCategory, system)}</div>
              <div className="text-muted-foreground break-words">Banda: {formatSystemBand(systemCategory, system)}</div>
              {system.provided_by && (
                <div className="text-muted-foreground">Sistema proporcionado por: {formatProviderLabel(system.provided_by)}</div>
              )}
              {system.notes && system.notes.trim() !== "" && (
                <div className="text-muted-foreground break-words">Notas: {system.notes}</div>
              )}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">Wireless</div>
          <div className="font-medium break-words">{formatSystems(artist.wireless_systems || [])}</div>
          <div className="text-muted-foreground">Proveedor: {formatProviderLabel(artist.wireless_provided_by)}</div>
          <div className="mt-2">{renderSystemDetails((artist.wireless_systems || []) as WirelessSystemLike[], "wireless")}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">IEM</div>
          <div className="font-medium break-words">{formatSystems(artist.iem_systems || [])}</div>
          <div className="text-muted-foreground">Proveedor: {formatProviderLabel(artist.iem_provided_by)}</div>
          <div className="mt-2">{renderSystemDetails((artist.iem_systems || []) as WirelessSystemLike[], "iem")}</div>
        </div>
      </div>
    );
  }

  if (category === "microphones") {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">Kit</div>
          <div className="font-medium">{formatProviderLabel(artist.mic_kit)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">Micros cableados</div>
          <div className="text-muted-foreground">{formatWiredMics(artist.wired_mics)}</div>
        </div>
      </div>
    );
  }

  if (category === "monitors") {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">Monitores</div>
          <div className="font-medium">
            {artist.monitors_enabled ? `${artist.monitors_quantity}x cuñas` : "Sin cuñas solicitadas"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">Extras</div>
          <div className="text-muted-foreground">
            {artist.extras_sf ? "Side Fill" : ""}
            {artist.extras_sf && (artist.extras_df || artist.extras_djbooth) ? " · " : ""}
            {artist.extras_df ? "Drum Fill" : ""}
            {artist.extras_df && artist.extras_djbooth ? " · " : ""}
            {artist.extras_djbooth ? "DJ Booth" : ""}
            {!artist.extras_sf && !artist.extras_df && !artist.extras_djbooth ? "Sin extras" : ""}
          </div>
        </div>
      </div>
    );
  }

  if (category === "infrastructure") {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">Conexiones</div>
          <div className="text-muted-foreground">{formatInfrastructure(artist)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground font-semibold">Proveedor</div>
          <div className="font-medium">{formatProviderLabel(artist.infrastructure_provided_by)}</div>
        </div>
      </div>
    );
  }


  if (category === "rider") {
    if (riderFiles.length === 0) {
      return <div className="text-sm text-muted-foreground">No hay riders disponibles para este artista.</div>;
    }

    return (
      <div className="space-y-2.5">
        {riderFiles.map((file) => (
          <div key={file.id} className="rounded-md border p-3 bg-muted/20">
            <div className="text-sm font-medium break-words">{file.file_name}</div>
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onViewRiderFile?.(file)}
                disabled={!onViewRiderFile}
              >
                Ver
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDownloadRiderFile?.(file)}
                disabled={!onDownloadRiderFile}
              >
                Descargar
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs uppercase text-muted-foreground font-semibold">Notas</div>
      <div className="text-muted-foreground whitespace-pre-wrap">
        {artist.notes && artist.notes.trim() !== "" ? artist.notes : "Sin notas"}
      </div>
    </div>
  );
};

function buildFormData(artist: Artist) {
  return {
    name: artist.name || "",
    stage: artist.stage || 1,
    date: artist.date || "",
    show_start: artist.show_start || "",
    show_end: artist.show_end || "",
    soundcheck: artist.soundcheck || false,
    soundcheck_start: artist.soundcheck_start || "",
    soundcheck_end: artist.soundcheck_end || "",
    foh_console: artist.foh_console || "",
    foh_console_provided_by: artist.foh_console_provided_by || "festival",
    mon_console: artist.mon_console || "",
    mon_console_provided_by: artist.mon_console_provided_by || "festival",
    monitors_from_foh: artist.monitors_from_foh || false,
    foh_waves_outboard: artist.foh_waves_outboard || "",
    mon_waves_outboard: artist.mon_waves_outboard || "",
    wireless_systems: artist.wireless_systems || [],
    iem_systems: artist.iem_systems || [],
    wireless_provided_by: artist.wireless_provided_by || "festival",
    iem_provided_by: artist.iem_provided_by || "festival",
    monitors_enabled: artist.monitors_enabled || false,
    monitors_quantity: artist.monitors_quantity || 0,
    extras_sf: artist.extras_sf || false,
    extras_df: artist.extras_df || false,
    extras_djbooth: artist.extras_djbooth || false,
    extras_wired: artist.extras_wired || "",
    infra_cat6: artist.infra_cat6 || false,
    infra_cat6_quantity: artist.infra_cat6_quantity || 0,
    infra_hma: artist.infra_hma || false,
    infra_hma_quantity: artist.infra_hma_quantity || 0,
    infra_coax: artist.infra_coax || false,
    infra_coax_quantity: artist.infra_coax_quantity || 0,
    infra_opticalcon_duo: artist.infra_opticalcon_duo || false,
    infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity || 0,
    infra_analog: artist.infra_analog || 0,
    infrastructure_provided_by: artist.infrastructure_provided_by || "festival",
    other_infrastructure: artist.other_infrastructure || "",
    notes: artist.notes || "",
    foh_tech: artist.foh_tech || false,
    mon_tech: artist.mon_tech || false,
    rider_missing: artist.rider_missing ?? false,
    isaftermidnight: artist.isaftermidnight || false,
    mic_kit: (artist.mic_kit || "festival") as 'festival' | 'band' | 'mixed',
    wired_mics: artist.wired_mics || [],
  };
}

export const MobileArtistConfigEditor = ({
  artist,
  category,
  jobId,
  selectedDate,
  onBack,
  onSaved,
}: MobileArtistConfigEditorProps) => {
  const [formData, setFormData] = useState(buildFormData(artist));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { combinedSetup } = useCombinedGearSetup(jobId, selectedDate, artist.stage);

  // Fetch fresh artist data on mount
  useEffect(() => {
    const fetchFreshData = async () => {
      try {
        const { data, error } = await supabase
          .from("festival_artists")
          .select("*")
          .eq("id", artist.id)
          .single();

        if (!error && data) {
          setFormData(buildFormData(data));
        }
      } catch (err) {
        console.error("Error fetching artist data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFreshData();
  }, [artist.id]);

  const updateFormData = (changes: any) => {
    setFormData(prev => ({ ...prev, ...changes }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build the update payload based on category
      let updatePayload: Record<string, any> = {};

      switch (category) {
        case 'consoles':
          updatePayload = {
            foh_console: formData.foh_console,
            foh_console_provided_by: formData.foh_console_provided_by,
            mon_console: formData.mon_console,
            mon_console_provided_by: formData.mon_console_provided_by,
            monitors_from_foh: formData.monitors_from_foh,
            foh_waves_outboard: formData.foh_waves_outboard || null,
            mon_waves_outboard: formData.mon_waves_outboard || null,
            foh_tech: formData.foh_tech,
            mon_tech: formData.mon_tech,
          };
          break;
        case 'wireless':
          updatePayload = {
            wireless_systems: formData.wireless_systems,
            wireless_provided_by: formData.wireless_provided_by,
            iem_systems: formData.iem_systems,
            iem_provided_by: formData.iem_provided_by,
          };
          break;
        case 'microphones':
          updatePayload = {
            mic_kit: formData.mic_kit,
            wired_mics: formData.wired_mics,
          };
          break;
        case 'monitors':
          updatePayload = {
            monitors_enabled: formData.monitors_enabled,
            monitors_quantity: formData.monitors_quantity,
            extras_sf: formData.extras_sf,
            extras_df: formData.extras_df,
            extras_djbooth: formData.extras_djbooth,
            extras_wired: formData.extras_wired || null,
          };
          break;
        case 'infrastructure':
          updatePayload = {
            infra_cat6: formData.infra_cat6,
            infra_cat6_quantity: formData.infra_cat6_quantity,
            infra_hma: formData.infra_hma,
            infra_hma_quantity: formData.infra_hma_quantity,
            infra_coax: formData.infra_coax,
            infra_coax_quantity: formData.infra_coax_quantity,
            infra_opticalcon_duo: formData.infra_opticalcon_duo,
            infra_opticalcon_duo_quantity: formData.infra_opticalcon_duo_quantity,
            infra_analog: formData.infra_analog,
            infrastructure_provided_by: formData.infrastructure_provided_by,
            other_infrastructure: formData.other_infrastructure || null,
          };
          break;
        case 'notes':
          updatePayload = {
            notes: formData.notes || null,
          };
          break;
      }

      const { error } = await supabase
        .from("festival_artists")
        .update(updatePayload)
        .eq("id", artist.id);

      if (error) throw error;

      toast.success("Configuración guardada");
      onSaved();
      onBack();
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Error al guardar la configuración");
    } finally {
      setIsSaving(false);
    }
  };

  const { title, subtitle } = CATEGORY_LABELS[category];
  const gearSetup = combinedSetup?.globalSetup || null;

  const renderSection = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    switch (category) {
      case 'consoles':
        return (
          <ConsoleSetupSection
            formData={formData as any}
            onChange={updateFormData}
            gearSetup={gearSetup}
          />
        );
      case 'wireless':
        return (
          <WirelessSetupSection
            formData={formData as any}
            onChange={updateFormData}
            gearSetup={gearSetup}
          />
        );
      case 'microphones':
        return (
          <MicKitSection
            micKit={formData.mic_kit}
            wiredMics={formData.wired_mics}
            onMicKitChange={(provider) => updateFormData({ mic_kit: provider })}
            onWiredMicsChange={(mics) => updateFormData({ wired_mics: mics })}
          />
        );
      case 'monitors':
        return (
          <>
            <MonitorSetupSection
              formData={formData as any}
              onChange={updateFormData}
              gearSetup={gearSetup}
            />
            <ExtraRequirementsSection
              formData={formData as any}
              onChange={updateFormData}
              gearSetup={gearSetup}
            />
          </>
        );
      case 'infrastructure':
        return (
          <InfrastructureSection
            formData={formData as any}
            onChange={updateFormData}
            gearSetup={gearSetup}
          />
        );
      case 'notes':
        return (
          <NotesSection
            formData={formData as any}
            onChange={updateFormData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-accent"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{title}</h2>
          <p className="text-xs text-muted-foreground truncate">{artist.name} — {subtitle}</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {renderSection()}
      </div>

      {/* Footer */}
      <div className="p-4 border-t shrink-0 bg-background">
        <Button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="w-full"
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
