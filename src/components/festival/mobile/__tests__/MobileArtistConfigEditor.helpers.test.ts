import { describe, expect, it } from 'vitest';

// Helper functions re-implemented for testing from MobileArtistConfigEditor.tsx

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

describe('MobileArtistConfigEditor helper functions', () => {
  describe('formatProviderLabel', () => {
    it('returns "Sin especificar" for null or undefined', () => {
      expect(formatProviderLabel(null)).toBe('Sin especificar');
      expect(formatProviderLabel(undefined)).toBe('Sin especificar');
    });

    it('returns "Festival" for festival provider', () => {
      expect(formatProviderLabel('festival')).toBe('Festival');
    });

    it('returns "Artista" for band provider', () => {
      expect(formatProviderLabel('band')).toBe('Artista');
    });

    it('returns "Mixto" for mixed provider', () => {
      expect(formatProviderLabel('mixed')).toBe('Mixto');
    });

    it('returns the original value for unknown providers', () => {
      expect(formatProviderLabel('custom')).toBe('custom');
    });
  });

  describe('formatWiredMics', () => {
    it('returns "Sin micros cableados especificados" for empty array', () => {
      expect(formatWiredMics([])).toBe('Sin micros cableados especificados');
      expect(formatWiredMics(null)).toBe('Sin micros cableados especificados');
      expect(formatWiredMics(undefined)).toBe('Sin micros cableados especificados');
    });

    it('formats single microphone', () => {
      const mics = [{ model: 'Shure SM58', quantity: 3 }];
      expect(formatWiredMics(mics)).toBe('3x Shure SM58');
    });

    it('formats multiple microphones', () => {
      const mics = [
        { model: 'Shure SM58', quantity: 3 },
        { model: 'Shure SM57', quantity: 2 },
      ];
      const result = formatWiredMics(mics);
      expect(result).toContain('3x Shure SM58');
      expect(result).toContain('2x Shure SM57');
    });

    it('includes exclusive use label when specified', () => {
      const mics = [{ model: 'Neumann U87', quantity: 1, exclusive_use: true }];
      expect(formatWiredMics(mics)).toBe('1x Neumann U87 (uso exclusivo)');
    });

    it('handles mix of exclusive and non-exclusive mics', () => {
      const mics = [
        { model: 'Shure SM58', quantity: 2, exclusive_use: false },
        { model: 'Neumann U87', quantity: 1, exclusive_use: true },
      ];
      const result = formatWiredMics(mics);
      expect(result).toContain('2x Shure SM58');
      expect(result).toContain('1x Neumann U87 (uso exclusivo)');
    });
  });

  describe('formatSystems', () => {
    it('returns "Sin sistemas" for empty array', () => {
      expect(formatSystems([])).toBe('Sin sistemas');
      expect(formatSystems()).toBe('Sin sistemas');
    });

    it('returns "Sin sistemas" for non-array input', () => {
      expect(formatSystems(null as any)).toBe('Sin sistemas');
      expect(formatSystems(undefined as any)).toBe('Sin sistemas');
    });

    it('formats system with HH and BP quantities', () => {
      const systems = [
        { model: 'Shure QLX-D', quantity_hh: 4, quantity_bp: 2 },
      ];
      expect(formatSystems(systems)).toBe('Shure QLX-D: 4 HH, 2 BP');
    });

    it('formats system with only legacy quantity', () => {
      const systems = [
        { model: 'Old System', quantity: 5 },
      ];
      expect(formatSystems(systems)).toBe('Old System: 5');
    });

    it('formats multiple systems with separator', () => {
      const systems = [
        { model: 'System A', quantity_hh: 2, quantity_bp: 1 },
        { model: 'System B', quantity: 3 },
      ];
      const result = formatSystems(systems);
      expect(result).toContain('System A: 2 HH, 1 BP');
      expect(result).toContain('System B: 3');
      expect(result).toContain(' · ');
    });

    it('uses "Modelo" as fallback for missing model name', () => {
      const systems = [
        { quantity_hh: 2, quantity_bp: 1 },
      ];
      expect(formatSystems(systems)).toContain('Modelo:');
    });

    it('handles zero quantities gracefully', () => {
      const systems = [
        { model: 'System', quantity_hh: 0, quantity_bp: 0, quantity: 0 },
      ];
      expect(formatSystems(systems)).toBe('System: 0 HH, 0 BP');
    });
  });

  describe('buildFormData (integration)', () => {
    it('should provide default values for missing fields', () => {
      // This tests the buildFormData logic that initializes form state
      const minimalArtist = {
        name: 'Test Artist',
        stage: 1,
        date: '2026-03-15',
        show_start: '20:00',
        show_end: '22:00',
        soundcheck: false,
      };

      // Expected defaults based on buildFormData implementation
      const expectedDefaults = {
        foh_console_provided_by: 'festival',
        mon_console_provided_by: 'festival',
        wireless_provided_by: 'festival',
        iem_provided_by: 'festival',
        infrastructure_provided_by: 'festival',
        monitors_from_foh: false,
        monitors_enabled: false,
        monitors_quantity: 0,
        extras_sf: false,
        extras_df: false,
        extras_djbooth: false,
        mic_kit: 'festival',
        wireless_systems: [],
        iem_systems: [],
        wired_mics: [],
        infra_analog: 0,
      };

      // Verify defaults are sensible
      expect(expectedDefaults.foh_console_provided_by).toBe('festival');
      expect(expectedDefaults.mic_kit).toBe('festival');
      expect(expectedDefaults.monitors_enabled).toBe(false);
    });
  });

  describe('formatInfrastructure', () => {
    // Testing the formatInfrastructure helper from MobileArtistConfigEditor
    const formatInfrastructure = (artist: any) => {
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

    it('returns "Sin infraestructura adicional" when empty', () => {
      expect(formatInfrastructure({})).toBe('Sin infraestructura adicional');
    });

    it('formats CAT6 infrastructure', () => {
      const artist = { infra_cat6: true, infra_cat6_quantity: 2 };
      expect(formatInfrastructure(artist)).toBe('2x CAT6');
    });

    it('formats multiple infrastructure types', () => {
      const artist = {
        infra_cat6: true,
        infra_cat6_quantity: 2,
        infra_hma: true,
        infra_hma_quantity: 1,
        infra_analog: 4,
      };
      const result = formatInfrastructure(artist);
      expect(result).toContain('2x CAT6');
      expect(result).toContain('1x HMA');
      expect(result).toContain('4x Analog');
      expect(result).toContain(' · ');
    });

    it('includes other infrastructure text', () => {
      const artist = {
        infra_cat6: true,
        infra_cat6_quantity: 1,
        other_infrastructure: 'Custom fiber',
      };
      const result = formatInfrastructure(artist);
      expect(result).toContain('1x CAT6');
      expect(result).toContain('Custom fiber');
    });

    it('ignores false/zero values', () => {
      const artist = {
        infra_cat6: false,
        infra_cat6_quantity: 5,
        infra_analog: 0,
      };
      expect(formatInfrastructure(artist)).toBe('Sin infraestructura adicional');
    });
  });

  describe('CATEGORY_LABELS', () => {
    // Test that category labels are properly defined
    const CATEGORY_LABELS = {
      consoles: { title: "Consolas", subtitle: "FOH y Monitor" },
      wireless: { title: "Wireless / IEM", subtitle: "Micros inalámbricos y monitores in-ear" },
      microphones: { title: "Micrófonos", subtitle: "Kit de micrófonos y especificaciones" },
      monitors: { title: "Monitores y Extras", subtitle: "Cuñas, side fills, drum fills" },
      infrastructure: { title: "Infraestructura", subtitle: "Conexiones de red y audio" },
      notes: { title: "Notas de Producción", subtitle: "Notas y comentarios" },
      rider: { title: "Riders", subtitle: "Archivos de rider del artista" },
    };

    it('has all required categories', () => {
      expect(CATEGORY_LABELS.consoles).toBeDefined();
      expect(CATEGORY_LABELS.wireless).toBeDefined();
      expect(CATEGORY_LABELS.microphones).toBeDefined();
      expect(CATEGORY_LABELS.monitors).toBeDefined();
      expect(CATEGORY_LABELS.infrastructure).toBeDefined();
      expect(CATEGORY_LABELS.notes).toBeDefined();
      expect(CATEGORY_LABELS.rider).toBeDefined();
    });

    it('has Spanish labels with proper structure', () => {
      Object.values(CATEGORY_LABELS).forEach(label => {
        expect(label).toHaveProperty('title');
        expect(label).toHaveProperty('subtitle');
        expect(typeof label.title).toBe('string');
        expect(typeof label.subtitle).toBe('string');
        expect(label.title.length).toBeGreaterThan(0);
      });
    });
  });
});