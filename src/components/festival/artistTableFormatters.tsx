/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from "@/components/ui/badge";
import type { Artist } from "@/components/festival/artistTableTypes";

export const formatInfrastructure = (artist: Artist): string => {
  const items: string[] = [];
  if (artist.infra_cat6 && artist.infra_cat6_quantity) items.push(`${artist.infra_cat6_quantity}x CAT6`);
  if (artist.infra_hma && artist.infra_hma_quantity) items.push(`${artist.infra_hma_quantity}x HMA`);
  if (artist.infra_coax && artist.infra_coax_quantity) items.push(`${artist.infra_coax_quantity}x Coax`);
  if (artist.infra_opticalcon_duo && artist.infra_opticalcon_duo_quantity) items.push(`${artist.infra_opticalcon_duo_quantity}x OpticalCON DUO`);
  if (artist.infra_analog && artist.infra_analog > 0) items.push(`${artist.infra_analog}x Analog`);
  if (artist.other_infrastructure) items.push(artist.other_infrastructure);
  return items.length > 0 ? items.join(", ") : "Ninguno";
};

export const formatNotes = (notes?: string): string => {
  if (!notes?.trim()) return "Sin notas";
  return notes.length > 50 ? `${notes.substring(0, 50)}...` : notes;
};

export const formatWiredMics = (mics: Array<{ model: string; quantity: number; exclusive_use?: boolean }> = []): string =>
  mics.length === 0 ? "Ninguno" : mics.map((mic) => `${mic.quantity}x ${mic.model}${mic.exclusive_use ? " (E)" : ""}`).join(", ");

export const formatWirelessSystems = (systems: any[] = [], isIEM = false): string => {
  if (systems.length === 0) return "Ninguno";
  return systems.map((system) => {
    if (isIEM) {
      const channels = system.quantity_hh || system.quantity || 0;
      const beltpacks = system.quantity_bp || 0;
      return `${system.model}: ${channels} ch${beltpacks > 0 ? `, ${beltpacks} bp` : ""}`;
    }
    const channels = system.quantity_ch || 0;
    const hh = system.quantity_hh || 0;
    const bp = system.quantity_bp || 0;
    const channelPart = channels > 0 ? `${channels} ch` : "";
    if (hh > 0 && bp > 0) return `${system.model}: ${channelPart ? `${channelPart}, ` : ""}${hh}x HH, ${bp}x BP`;
    if (hh + bp > 0) return `${system.model}: ${channelPart ? `${channelPart}, ` : ""}${hh + bp}x`;
    if (channels > 0) return `${system.model}: ${channels} ch`;
    return system.model;
  }).join("; ");
};

const providerClasses = { festival: "bg-blue-100 text-blue-800", band: "bg-green-100 text-green-800", mixed: "bg-purple-100 text-purple-800" } as const;
const providerLabels = { festival: "Festival", band: "Banda", mixed: "Mixto" } as const;

export const renderProviderBadge = (provider?: keyof typeof providerLabels) =>
  provider ? <Badge variant="outline" className={`text-xs px-1 py-0 ${providerClasses[provider]}`}>{providerLabels[provider]}</Badge> : null;

export const formatTime = (value?: string | null): string => {
  if (!value) return "";
  const trimmed = String(value).trim();
  return trimmed.length >= 5 && trimmed.includes(":") ? trimmed.slice(0, 5) : trimmed;
};

export const formatTimeRange = (start?: string | null, end?: string | null): string =>
  `${formatTime(start) || "--:--"} - ${formatTime(end) || "--:--"}`;
