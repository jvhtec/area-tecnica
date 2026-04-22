import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sliders, Radio, Mic2, Speaker, Cable, StickyNote, FileDown,
  Link, FileText, Printer, Pencil, Trash2, ImagePlus, ImageOff,
  Loader2, MoreHorizontal, Receipt
} from "lucide-react";
import { ConfigSummaryRow } from "./ConfigSummaryRow";
import { GearMismatchIndicator } from "../GearMismatchIndicator";
import type { ArtistGearComparison } from "@/utils/gearComparisonService";

interface Artist {
  id: string;
  name: string;
  stage: number;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  foh_console: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_from_foh?: boolean;
  foh_waves_outboard?: string;
  mon_waves_outboard?: string;
  wireless_systems: any[];
  wireless_provided_by?: 'festival' | 'band' | 'mixed';
  iem_systems: any[];
  iem_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
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
  infrastructure_provided_by?: 'festival' | 'band' | 'mixed';
  artist_submitted?: boolean;
  stage_plot_file_path?: string | null;
  stage_plot_file_name?: string | null;
}

// --- Summary Formatters ---

function getConsoleSummary(artist: Artist): string {
  if (artist.monitors_from_foh) {
    const foh = artist.foh_console || "Sin especificar";
    return `FOH: ${foh} (Mon desde FOH)`;
  }
  const parts: string[] = [];
  if (artist.foh_console) {
    const prov = artist.foh_console_provided_by ? ` (${artist.foh_console_provided_by})` : "";
    parts.push(`FOH: ${artist.foh_console}${prov}`);
  }
  if (artist.mon_console) {
    const prov = artist.mon_console_provided_by ? ` (${artist.mon_console_provided_by})` : "";
    parts.push(`MON: ${artist.mon_console}${prov}`);
  }
  return parts.length > 0 ? parts.join(", ") : "Sin configurar";
}

function getWirelessSummary(artist: Artist): string {
  const parts: string[] = [];
  const ws = artist.wireless_systems || [];
  const iems = artist.iem_systems || [];

  if (ws.length > 0) {
    const totalHH = ws.reduce((sum, s) => sum + (Number(s.quantity_hh) || 0), 0);
    const totalBP = ws.reduce((sum, s) => sum + (Number(s.quantity_bp) || 0), 0);
    const model = ws[0]?.model || "Wireless";
    const counts = [totalHH > 0 && `${totalHH} HH`, totalBP > 0 && `${totalBP} BP`].filter(Boolean).join(" + ");
    parts.push(counts ? `${counts} ${model}` : model);
  }
  if (iems.length > 0) {
    const totalCh = iems.reduce((sum, s) => sum + (Number(s.quantity_hh) || Number(s.quantity) || 0), 0);
    const model = iems[0]?.model || "IEM";
    parts.push(`${totalCh} Ch ${model}`);
  }
  return parts.length > 0 ? parts.join(", ") : "Ninguno";
}

function getMicSummary(artist: Artist): string {
  const kit = artist.mic_kit || "band";
  const label = kit === "festival" ? "Festival" : kit === "mixed" ? "Mixed" : "Band";
  const mics = artist.wired_mics || [];
  if ((kit === "festival" || kit === "mixed") && mics.length > 0) {
    const totalMics = mics.reduce((sum, m) => sum + (m.quantity || 0), 0);
    return `${label} Kit + ${totalMics} micros`;
  }
  return `${label} Kit`;
}

function getMonitorSummary(artist: Artist): string {
  const parts: string[] = [];
  if (artist.monitors_enabled && artist.monitors_quantity > 0) {
    parts.push(`${artist.monitors_quantity}x Cuñas`);
  }
  if (artist.extras_sf) parts.push("SF");
  if (artist.extras_df) parts.push("DF");
  if (artist.extras_djbooth) parts.push("DJ");
  return parts.length > 0 ? parts.join(", ") : "Ninguno";
}

function getInfraSummary(artist: Artist): string {
  const items: string[] = [];
  if (artist.infra_cat6 && artist.infra_cat6_quantity) items.push(`${artist.infra_cat6_quantity}x CAT6`);
  if (artist.infra_hma && artist.infra_hma_quantity) items.push(`${artist.infra_hma_quantity}x HMA`);
  if (artist.infra_coax && artist.infra_coax_quantity) items.push(`${artist.infra_coax_quantity}x Coax`);
  if (artist.infra_opticalcon_duo && artist.infra_opticalcon_duo_quantity) items.push(`${artist.infra_opticalcon_duo_quantity}x OpticalCON`);
  if (artist.infra_analog && artist.infra_analog > 0) items.push(`${artist.infra_analog}x Analog`);
  if (artist.other_infrastructure) items.push(artist.other_infrastructure);
  return items.length > 0 ? items.join(", ") : "Ninguno";
}

function hasMonitorWarning(artist: Artist): boolean {
  return !artist.monitors_enabled && !artist.extras_sf && !artist.extras_df;
}

function hasWirelessData(artist: Artist): boolean {
  return (artist.wireless_systems?.length > 0) || (artist.iem_systems?.length > 0);
}

function hasInfraData(artist: Artist): boolean {
  return !!(artist.infra_cat6 || artist.infra_hma || artist.infra_coax || artist.infra_opticalcon_duo || (artist.infra_analog && artist.infra_analog > 0) || artist.other_infrastructure);
}

function formatTimeCompact(value?: string | null): string {
  if (!value) return "--:--";
  const trimmed = String(value).trim();
  if (trimmed.length >= 5 && trimmed.includes(":")) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

function formatTimeRange(start?: string | null, end?: string | null): string {
  return `${formatTimeCompact(start)}-${formatTimeCompact(end)}`;
}

// --- Types ---

export type MobileConfigCategory = 'consoles' | 'wireless' | 'microphones' | 'monitors' | 'infrastructure' | 'notes' | 'rider';

export type MobileArtistRiderFile = {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at?: string | null;
};

interface MobileArtistCardProps {
  artist: Artist;
  stageName: string;
  stagePlotUrl?: string;
  gearComparison?: ArtistGearComparison;
  mode?: 'edit' | 'readonly';
  onEditCategory: (artistId: string, category: MobileConfigCategory) => void;
  onEditArtist: (artist: Artist) => void;
  onGenerateLink: (artist: Artist) => void;
  onManageFiles: (artist: Artist) => void;
  onPrintArtist: (artist: Artist) => void;
  onDeleteArtist: (artist: Artist) => void;
  onOpenStagePlotCapture: (artist: Artist) => void;
  onDeleteStagePlot: (artist: Artist) => void;
  printingArtistId: string | null;
  deletingArtistId: string | null;
  uploadingStagePlotArtistId: string | null;
  deletingStagePlotArtistId: string | null;
  isCreatingExtrasFor: (id: string) => boolean;
  onCreateFlexExtras: (artistId: string, artistName: string, artistDate: string, showStart: string, showEnd: string, isAfterMidnight: boolean) => void;
  riderFiles?: MobileArtistRiderFile[];
}

export const MobileArtistCard = ({
  artist,
  stageName,
  stagePlotUrl,
  gearComparison,
  mode = 'edit',
  onEditCategory,
  onEditArtist,
  onGenerateLink,
  onManageFiles,
  onPrintArtist,
  onDeleteArtist,
  onOpenStagePlotCapture,
  onDeleteStagePlot,
  printingArtistId,
  deletingArtistId,
  uploadingStagePlotArtistId,
  deletingStagePlotArtistId,
  isCreatingExtrasFor,
  onCreateFlexExtras,
  riderFiles = [],
}: MobileArtistCardProps) => {
  return (
    <div className="border rounded-xl bg-card overflow-hidden max-w-full">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate">{artist.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {artist.artist_submitted && (
                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-900 border-amber-300">
                  Enviado
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">{stageName}</Badge>
              <Badge
                variant={artist.rider_missing ? "destructive" : "default"}
                className="text-[10px]"
              >
                {artist.rider_missing ? "Faltante" : "Completo"}
              </Badge>
              {artist.isaftermidnight && (
                <Badge variant="outline" className="text-[10px] bg-blue-700 text-white">
                  AM
                </Badge>
              )}
            </div>
          </div>
          {gearComparison && (
            <GearMismatchIndicator mismatches={gearComparison.mismatches} compact />
          )}
        </div>

        {/* Time Row */}
        <div className={`grid gap-2 mt-3 ${artist.soundcheck ? 'grid-cols-1 min-[380px]:grid-cols-2' : 'grid-cols-1'}`}>
          <div className="p-2.5 rounded-lg bg-muted/50 border min-w-0 overflow-hidden">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Hora del Show</div>
            <div className="text-xs font-bold font-mono truncate">{formatTimeRange(artist.show_start, artist.show_end)}</div>
          </div>
          {artist.soundcheck && (
            <div className="p-2.5 rounded-lg bg-muted/50 border min-w-0 overflow-hidden">
              <div className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Soundcheck</div>
              <div className="text-xs font-mono text-muted-foreground truncate">{formatTimeRange(artist.soundcheck_start, artist.soundcheck_end)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stage Plot */}
      {stagePlotUrl && (
        <div className="px-4 pb-2">
          <button
            type="button"
            className="h-20 w-full overflow-hidden rounded-lg border"
            onClick={() => window.open(stagePlotUrl, "_blank", "noopener,noreferrer")}
          >
            <img
              src={stagePlotUrl}
              alt={`Stage plot de ${artist.name}`}
              className="h-full w-full object-cover"
            />
          </button>
        </div>
      )}

      {/* Technical Requirements Summary Cards */}
      <div className="px-4 pb-3 space-y-2">
        <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider pt-1">
          Requerimientos Técnicos
        </div>

        <ConfigSummaryRow
          icon={Sliders}
          title="Consolas"
          summary={getConsoleSummary(artist)}
          onClick={() => onEditCategory(artist.id, 'consoles')}
        />

        <ConfigSummaryRow
          icon={Radio}
          title="Wireless / IEM"
          summary={getWirelessSummary(artist)}
          warning={!hasWirelessData(artist)}
          onClick={() => onEditCategory(artist.id, 'wireless')}
        />

        <ConfigSummaryRow
          icon={Mic2}
          title="Micrófonos"
          summary={getMicSummary(artist)}
          onClick={() => onEditCategory(artist.id, 'microphones')}
        />

        <ConfigSummaryRow
          icon={Speaker}
          title="Monitores y Extras"
          summary={getMonitorSummary(artist)}
          warning={hasMonitorWarning(artist)}
          onClick={() => onEditCategory(artist.id, 'monitors')}
        />

        <ConfigSummaryRow
          icon={Cable}
          title="Infraestructura"
          summary={getInfraSummary(artist)}
          warning={!hasInfraData(artist)}
          onClick={() => onEditCategory(artist.id, 'infrastructure')}
        />

        {artist.notes && artist.notes.trim() !== '' && (
          <ConfigSummaryRow
            icon={StickyNote}
            title="Notas"
            summary={artist.notes.length > 60 ? artist.notes.substring(0, 60) + "..." : artist.notes}
            onClick={() => onEditCategory(artist.id, 'notes')}
          />
        )}

        {mode === 'readonly' && riderFiles.length > 0 && (
          <ConfigSummaryRow
            icon={FileDown}
            title="Riders"
            summary={riderFiles.length === 1 ? riderFiles[0].file_name : `${riderFiles.length} archivos disponibles`}
            onClick={() => onEditCategory(artist.id, 'rider')}
          />
        )}
      </div>

      {/* Notes placeholder if no notes */}
      {(!artist.notes || artist.notes.trim() === '') && (
        <div className="px-4 pb-3">
          {mode === 'edit' ? (
            <button
              type="button"
              onClick={() => onEditCategory(artist.id, 'notes')}
              className="w-full p-3 rounded-lg border border-dashed text-left"
            >
              <div className="text-xs font-semibold text-muted-foreground">Notas de Producción</div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">Toca para añadir notas...</div>
            </button>
          ) : (
            <div className="w-full p-3 rounded-lg border border-dashed text-left">
              <div className="text-xs font-semibold text-muted-foreground">Notas de Producción</div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">Sin notas</div>
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      {mode === 'edit' && (
        <div className="flex items-center justify-between gap-1 px-3 py-2 border-t bg-muted/30">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onGenerateLink(artist)}>
            <Link className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onManageFiles(artist)}>
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onPrintArtist(artist)}
            disabled={printingArtistId === artist.id}
          >
            {printingArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onOpenStagePlotCapture(artist)}
            disabled={uploadingStagePlotArtistId === artist.id}
          >
            {uploadingStagePlotArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </Button>
          {artist.stage_plot_file_path && (
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => onDeleteStagePlot(artist)}
              disabled={deletingStagePlotArtistId === artist.id}
            >
              {deletingStagePlotArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageOff className="h-4 w-4" />}
            </Button>
          )}
          {gearComparison?.mismatches.some(m => m.severity === 'error') && (
            <Button
              variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => onCreateFlexExtras(artist.id, artist.name, artist.date, artist.show_start, artist.show_end, artist.isaftermidnight || false)}
              disabled={isCreatingExtrasFor(artist.id)}
              title="Crear presupuesto extras en Flex"
            >
              {isCreatingExtrasFor(artist.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditArtist(artist)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
            onClick={() => onDeleteArtist(artist)}
            disabled={deletingArtistId === artist.id}
          >
            {deletingArtistId === artist.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
};
