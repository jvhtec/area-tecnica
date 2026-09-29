import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Save, Loader2, Sliders, Radio, Mic2, Speaker, Cable, StickyNote, ChevronRight, CheckCircle2 } from "lucide-react";
import { BasicInfoSection } from "../form/sections/BasicInfoSection";
import { ConsoleSetupSection } from "../form/sections/ConsoleSetupSection";
import { WirelessSetupSection } from "../form/sections/WirelessSetupSection";
import { MicKitSection } from "../form/sections/MicKitSection";
import { MonitorSetupSection } from "../form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "../form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "../form/sections/InfrastructureSection";
import { NotesSection } from "../form/sections/NotesSection";
import { useCombinedGearSetup } from "@/hooks/useCombinedGearSetup";
import { dataLayerClient } from "@/services/dataLayerClient";
import { toArtistFormValues, type ArtistFormValues, type ArtistEditTarget, type ArtistRowInput } from "@/features/festival-artists/model";
import type { LucideIcon } from "lucide-react";

type FormSection = 'hub' | 'consoles' | 'wireless' | 'microphones' | 'monitors' | 'infrastructure' | 'notes';

interface MobileArtistFormSheetProps {
  artist?: ArtistEditTarget | null;
  jobId?: string;
  selectedDate: string;
  dayStartTime: string;
  onSubmit: (data: ArtistFormValues) => Promise<void>;
  isSubmitting: boolean;
  onClose: () => void;
}

interface SectionRowProps {
  icon: LucideIcon;
  title: string;
  summary: string;
  completed?: boolean;
  onClick: () => void;
}

const SectionRow = ({ icon: Icon, title, summary, completed, onClick }: SectionRowProps) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full p-3 rounded-lg border bg-card hover:bg-accent/50 active:bg-accent/70 transition-colors flex items-center gap-3"
  >
    <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0 text-left">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-sm font-semibold">{title}</span>
        {completed && <CheckCircle2 size={14} className="text-emerald-500/60 shrink-0" />}
      </div>
      <div className="text-xs text-muted-foreground truncate">{summary}</div>
    </div>
    <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
  </button>
);

const SECTION_META: Record<Exclude<FormSection, 'hub'>, { title: string; subtitle: string }> = {
  consoles: { title: "Consolas", subtitle: "FOH y Monitor" },
  wireless: { title: "Wireless / IEM", subtitle: "Micros inalámbricos y monitores in-ear" },
  microphones: { title: "Micrófonos", subtitle: "Kit y micros adicionales" },
  monitors: { title: "Monitores y Extras", subtitle: "Cuñas, side fills, drum fills" },
  infrastructure: { title: "Infraestructura", subtitle: "Conexiones de red y audio" },
  notes: { title: "Notas", subtitle: "Notas de producción" },
};

const buildFormData = (artistData: ArtistRowInput | null | undefined, selectedDate?: string) =>
  toArtistFormValues(artistData, { selectedDate });

// Summary helpers
function consoleSummary(fd: ArtistFormValues): string {
  if (!fd.foh_console && !fd.mon_console) return "Sin configurar";
  const parts: string[] = [];
  if (fd.foh_console) parts.push(`FOH: ${fd.foh_console}`);
  if (fd.monitors_from_foh) {
    parts.push("Mon desde FOH");
  } else if (fd.mon_console) {
    parts.push(`MON: ${fd.mon_console}`);
  }
  return parts.join(", ");
}

function wirelessSummary(fd: ArtistFormValues): string {
  const ws = fd.wireless_systems || [];
  const iems = fd.iem_systems || [];
  if (ws.length === 0 && iems.length === 0) {
    if (fd.wireless_provided_by === "band" || fd.iem_provided_by === "band") {
      return "Aporta banda (sin detalle)";
    }
    return "Sin configurar";
  }
  const parts: string[] = [];
  if (ws.length > 0) parts.push(`${ws.length} sist. wireless`);
  if (iems.length > 0) parts.push(`${iems.length} sist. IEM`);
  return parts.join(", ");
}

function micSummary(fd: ArtistFormValues): string {
  const label = fd.mic_kit === "festival" ? "Festival" : fd.mic_kit === "mixed" ? "Mixed" : "Band";
  const mics = fd.wired_mics || [];
  if (mics.length > 0) return `${label} Kit + ${mics.length} micros`;
  return `${label} Kit`;
}

function monitorSummary(fd: ArtistFormValues): string {
  const parts: string[] = [];
  if (fd.monitors_enabled && fd.monitors_quantity > 0) parts.push(`${fd.monitors_quantity}x Cuñas`);
  if (fd.extras_sf) parts.push("SF");
  if (fd.extras_df) parts.push("DF");
  if (fd.extras_djbooth) parts.push("DJ");
  return parts.length > 0 ? parts.join(", ") : "Sin configurar";
}

function infraSummary(fd: ArtistFormValues): string {
  const items: string[] = [];
  if (fd.infra_cat6 && fd.infra_cat6_quantity) items.push(`${fd.infra_cat6_quantity}x CAT6`);
  if (fd.infra_hma && fd.infra_hma_quantity) items.push(`${fd.infra_hma_quantity}x HMA`);
  if (fd.infra_coax && fd.infra_coax_quantity) items.push(`${fd.infra_coax_quantity}x Coax`);
  if (fd.infra_opticalcon_duo && fd.infra_opticalcon_duo_quantity) items.push(`${fd.infra_opticalcon_duo_quantity}x OpticalCON`);
  if (fd.infra_analog && fd.infra_analog > 0) items.push(`${fd.infra_analog}x Analog`);
  return items.length > 0 ? items.join(", ") : "Sin configurar";
}

export const MobileArtistFormSheet = ({
  artist,
  jobId,
  selectedDate,
  dayStartTime,
  onSubmit,
  isSubmitting,
  onClose,
}: MobileArtistFormSheetProps) => {
  const [activeSection, setActiveSection] = useState<FormSection>('hub');
  const [formData, setFormData] = useState(buildFormData(artist, selectedDate));
  const [isLoading, setIsLoading] = useState(false);
  const { combinedSetup } = useCombinedGearSetup(jobId || '', selectedDate, formData.stage);
  const gearSetup = combinedSetup?.globalSetup || null;

  // Fetch fresh data if editing
  useEffect(() => {
    if (!artist?.id) return;
    setIsLoading(true);
    const fetchArtist = async () => {
      try {
        const { data, error } = await dataLayerClient.from("festival_artists")
          .select("*")
          .eq("id", artist.id)
          .single();
        if (!error && data) {
          setFormData(buildFormData(data, selectedDate));
        }
      } catch (err) {
        console.error("Error fetching artist:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArtist();
  }, [artist?.id, selectedDate]);

  const updateFormData = (changes: Partial<ArtistFormValues>) => {
    setFormData(prev => ({ ...prev, ...changes }));
  };

  const handleSubmit = async () => {
    await onSubmit(formData);
  };

  // Section drill-down view
  if (activeSection !== 'hub') {
    const meta = SECTION_META[activeSection];
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col pt-[max(0px,env(safe-area-inset-top))] pb-[max(0px,env(safe-area-inset-bottom))] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('hub')}
            className="p-2 -ml-2 rounded-full hover:bg-accent"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{meta.title}</h2>
            <p className="text-xs text-muted-foreground truncate">{meta.subtitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeSection === 'consoles' && (
            <ConsoleSetupSection formData={formData} onChange={updateFormData} gearSetup={gearSetup} />
          )}
          {activeSection === 'wireless' && (
            <WirelessSetupSection formData={formData} onChange={updateFormData} gearSetup={gearSetup} />
          )}
          {activeSection === 'microphones' && (
            <MicKitSection
              micKit={formData.mic_kit}
              wiredMics={formData.wired_mics}
              onMicKitChange={(provider) => updateFormData({ mic_kit: provider })}
              onWiredMicsChange={(mics) => updateFormData({ wired_mics: mics })}
            />
          )}
          {activeSection === 'monitors' && (
            <>
              <MonitorSetupSection formData={formData} onChange={updateFormData} gearSetup={gearSetup} />
              <ExtraRequirementsSection formData={formData} onChange={updateFormData} gearSetup={gearSetup} />
            </>
          )}
          {activeSection === 'infrastructure' && (
            <InfrastructureSection formData={formData} onChange={updateFormData} gearSetup={gearSetup} />
          )}
          {activeSection === 'notes' && (
            <NotesSection formData={formData} onChange={updateFormData} />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t shrink-0 bg-background">
          <Button onClick={() => setActiveSection('hub')} className="w-full" size="lg">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
    );
  }

  // Hub view: BasicInfo + section navigation + submit
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col pt-[max(0px,env(safe-area-inset-top))] pb-[max(0px,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-accent"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">
            {artist ? "Editar Artista" : "Agregar Artista"}
          </h2>
          {formData.name && (
            <p className="text-xs text-muted-foreground truncate">{formData.name}</p>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <Loading hideLabel size="md" className="py-12" />
        ) : (
          <>
            {/* Basic Info - always visible */}
            <BasicInfoSection formData={formData} onChange={updateFormData} gearSetup={gearSetup} />

            {/* Technical Sections Navigation */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider pt-2">
                Configuración Técnica
              </div>

              <SectionRow
                icon={Sliders}
                title="Consolas"
                summary={consoleSummary(formData)}
                completed={!!formData.foh_console}
                onClick={() => setActiveSection('consoles')}
              />
              <SectionRow
                icon={Radio}
                title="Wireless / IEM"
                summary={wirelessSummary(formData)}
                completed={(formData.wireless_systems?.length > 0) || (formData.iem_systems?.length > 0)}
                onClick={() => setActiveSection('wireless')}
              />
              <SectionRow
                icon={Mic2}
                title="Micrófonos"
                summary={micSummary(formData)}
                completed={true}
                onClick={() => setActiveSection('microphones')}
              />
              <SectionRow
                icon={Speaker}
                title="Monitores y Extras"
                summary={monitorSummary(formData)}
                completed={formData.monitors_enabled || formData.extras_sf || formData.extras_df}
                onClick={() => setActiveSection('monitors')}
              />
              <SectionRow
                icon={Cable}
                title="Infraestructura"
                summary={infraSummary(formData)}
                completed={formData.infra_cat6 || formData.infra_hma || formData.infra_coax || (formData.infra_analog > 0)}
                onClick={() => setActiveSection('infrastructure')}
              />
              <SectionRow
                icon={StickyNote}
                title="Notas"
                summary={formData.notes ? (formData.notes.length > 50 ? formData.notes.substring(0, 50) + "..." : formData.notes) : "Sin notas"}
                completed={!!formData.notes}
                onClick={() => setActiveSection('notes')}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer - Submit */}
      <div className="p-4 border-t shrink-0 bg-background">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || isLoading || !formData.name}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {artist ? "Actualizar Artista" : "Agregar Artista"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
