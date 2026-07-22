import {
  getProviderSummary,
  getRfSystemChannels,
  type ArtistRfIemData,
} from "@/utils/rfIemTablePdfExport";

export interface ArtistRfInventorySummary {
  totalRf: number;
  totalIem: number;
  totalHh: number;
  totalBp: number;
  rfProvider: string;
  iemProvider: string;
  dominantProvider: string;
  providerColor: string;
}

export function getProviderColor(provider: string): string {
  const normalized = provider.toLowerCase();
  if (normalized === "festival") return "#3B82F6";
  if (normalized === "banda" || normalized === "band") return "#F59E0B";
  if (normalized === "mixto" || normalized === "mixed") return "#22C55E";
  return "#6B7280";
}

export function summarizeArtistRfInventory(
  artist: ArtistRfIemData,
): ArtistRfInventorySummary {
  const rfProvider = getProviderSummary(artist.wirelessSystems);
  const iemProvider = getProviderSummary(artist.iemSystems);
  const dominantProvider = rfProvider || iemProvider || "Festival";

  return {
    totalRf: artist.wirelessSystems.reduce(
      (sum, system) => sum + getRfSystemChannels(system),
      0,
    ),
    totalIem: artist.iemSystems.reduce(
      (sum, system) => sum + (system.quantity_hh || system.quantity || 0),
      0,
    ),
    totalHh: artist.wirelessSystems.reduce(
      (sum, system) => sum + (system.quantity_hh || 0),
      0,
    ),
    totalBp: artist.wirelessSystems.reduce(
      (sum, system) => sum + (system.quantity_bp || 0),
      0,
    ),
    rfProvider,
    iemProvider,
    dominantProvider,
    providerColor: getProviderColor(dominantProvider),
  };
}
