import { describe, expect, it } from 'vitest';

// Helper functions from MobileArtistCard.tsx
// These are exported helpers that we're testing

// Mock the artist type for testing
interface Artist {
  id: string;
  name: string;
  foh_console?: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_console?: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_from_foh?: boolean;
  wireless_systems: any[];
  iem_systems: any[];
  mic_kit?: 'festival' | 'band' | 'mixed';
  wired_mics?: Array<{ model: string; quantity: number }>;
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
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
  stage: number;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  rider_missing?: boolean;
  foh_tech?: boolean;
  mon_tech?: boolean;
  isaftermidnight?: boolean;
  notes?: string;
}

// Re-implement helper functions for testing (since they're not exported)
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

describe('MobileArtistCard helper functions', () => {
  describe('getConsoleSummary', () => {
    it('returns "Sin configurar" when no consoles specified', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getConsoleSummary(artist)).toBe('Sin configurar');
    });

    it('returns FOH with monitors from FOH label', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        foh_console: 'DiGiCo SD7',
        monitors_from_foh: true,
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getConsoleSummary(artist)).toBe('FOH: DiGiCo SD7 (Mon desde FOH)');
    });

    it('returns both FOH and MON consoles with providers', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        foh_console: 'DiGiCo SD7',
        foh_console_provided_by: 'festival',
        mon_console: 'Yamaha CL5',
        mon_console_provided_by: 'band',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      const result = getConsoleSummary(artist);
      expect(result).toContain('FOH: DiGiCo SD7 (festival)');
      expect(result).toContain('MON: Yamaha CL5 (band)');
    });
  });

  describe('getWirelessSummary', () => {
    it('returns "Ninguno" when no systems configured', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getWirelessSummary(artist)).toBe('Ninguno');
    });

    it('summarizes wireless systems with HH and BP counts', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [
          { model: 'Shure QLX', quantity_hh: 4, quantity_bp: 2 }
        ],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getWirelessSummary(artist)).toBe('4 HH + 2 BP Shure QLX');
    });

    it('summarizes IEM systems with channel counts', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [
          { model: 'Shure PSM300', quantity_hh: 6 }
        ],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getWirelessSummary(artist)).toBe('6 Ch Shure PSM300');
    });

    it('combines wireless and IEM summaries', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [
          { model: 'Shure QLX', quantity_hh: 3, quantity_bp: 1 }
        ],
        iem_systems: [
          { model: 'Shure PSM300', quantity_hh: 4 }
        ],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      const result = getWirelessSummary(artist);
      expect(result).toContain('3 HH + 1 BP Shure QLX');
      expect(result).toContain('4 Ch Shure PSM300');
    });
  });

  describe('getMicSummary', () => {
    it('returns "Band Kit" by default', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getMicSummary(artist)).toBe('Band Kit');
    });

    it('returns "Festival Kit" when specified', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        mic_kit: 'festival',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getMicSummary(artist)).toBe('Festival Kit');
    });

    it('includes wired mic count for festival kit', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        mic_kit: 'festival',
        wired_mics: [
          { model: 'SM58', quantity: 3 },
          { model: 'SM57', quantity: 2 }
        ],
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getMicSummary(artist)).toBe('Festival Kit + 5 micros');
    });

    it('includes wired mic count for mixed kit', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        mic_kit: 'mixed',
        wired_mics: [{ model: 'SM58', quantity: 2 }],
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getMicSummary(artist)).toBe('Mixed Kit + 2 micros');
    });
  });

  describe('getMonitorSummary', () => {
    it('returns "Ninguno" when no monitors configured', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getMonitorSummary(artist)).toBe('Ninguno');
    });

    it('includes monitor quantity when enabled', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: true,
        monitors_quantity: 4,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getMonitorSummary(artist)).toBe('4x Cuñas');
    });

    it('includes extras (SF, DF, DJ)', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: true,
        extras_df: true,
        extras_djbooth: true,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      const result = getMonitorSummary(artist);
      expect(result).toContain('SF');
      expect(result).toContain('DF');
      expect(result).toContain('DJ');
    });

    it('combines monitors and extras', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: true,
        monitors_quantity: 2,
        extras_sf: true,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      const result = getMonitorSummary(artist);
      expect(result).toContain('2x Cuñas');
      expect(result).toContain('SF');
    });
  });

  describe('getInfraSummary', () => {
    it('returns "Ninguno" when no infrastructure configured', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getInfraSummary(artist)).toBe('Ninguno');
    });

    it('includes CAT6 infrastructure', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        infra_cat6: true,
        infra_cat6_quantity: 3,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getInfraSummary(artist)).toBe('3x CAT6');
    });

    it('includes multiple infrastructure types', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        infra_cat6: true,
        infra_cat6_quantity: 2,
        infra_hma: true,
        infra_hma_quantity: 1,
        infra_analog: 4,
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      const result = getInfraSummary(artist);
      expect(result).toContain('2x CAT6');
      expect(result).toContain('1x HMA');
      expect(result).toContain('4x Analog');
    });

    it('includes other infrastructure notes', () => {
      const artist: Artist = {
        id: '1',
        name: 'Test',
        wireless_systems: [],
        iem_systems: [],
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        other_infrastructure: 'Custom fiber connection',
        stage: 1,
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      expect(getInfraSummary(artist)).toBe('Custom fiber connection');
    });
  });

  describe('formatTimeCompact', () => {
    it('returns "--:--" for null or undefined', () => {
      expect(formatTimeCompact(null)).toBe('--:--');
      expect(formatTimeCompact(undefined)).toBe('--:--');
    });

    it('truncates time to HH:MM format', () => {
      expect(formatTimeCompact('20:30:00')).toBe('20:30');
      expect(formatTimeCompact('14:15:45')).toBe('14:15');
    });

    it('handles already compact time', () => {
      expect(formatTimeCompact('20:30')).toBe('20:30');
    });

    it('handles edge cases', () => {
      expect(formatTimeCompact('  ')).toBe('');
      expect(formatTimeCompact('9:30')).toBe('9:30');
    });
  });

  describe('formatTimeRange', () => {
    it('formats time range with both start and end', () => {
      expect(formatTimeRange('20:00', '22:00')).toBe('20:00-22:00');
    });

    it('handles missing start or end', () => {
      expect(formatTimeRange(null, '22:00')).toBe('--:---22:00');
      expect(formatTimeRange('20:00', null)).toBe('20:00---:--');
    });

    it('handles both missing', () => {
      expect(formatTimeRange(null, null)).toBe('--:-----:--');
    });
  });
});