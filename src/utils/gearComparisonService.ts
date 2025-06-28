import { ConsoleSetup, WirelessSetup, FestivalGearSetup, StageGearSetup, WiredMicSetup } from "@/types/festival";

export interface GearMismatch {
  type: 'console' | 'wireless' | 'iem' | 'infrastructure' | 'extras' | 'monitors';
  severity: 'error' | 'warning';
  message: string;
  details?: string;
}

export interface ArtistGearComparison {
  artistName: string;
  stage: number;
  mismatches: GearMismatch[];
  hasConflicts: boolean;
}

interface ArtistRequirements {
  name: string;
  stage: number;
  foh_console: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  wireless_systems: WirelessSetup[];
  wireless_provided_by?: 'festival' | 'band' | 'mixed';
  iem_systems: WirelessSetup[];
  iem_provided_by?: 'festival' | 'band' | 'mixed';
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
  infrastructure_provided_by?: 'festival' | 'band' | 'mixed';
  mic_kit?: 'festival' | 'band' | 'mixed';
  wired_mics?: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
}

interface AvailableGear {
  foh_consoles: ConsoleSetup[];
  mon_consoles: ConsoleSetup[];
  wireless_systems: WirelessSetup[];
  iem_systems: WirelessSetup[];
  wired_mics: WiredMicSetup[];
  available_monitors: number;
  has_side_fills: boolean;
  has_drum_fills: boolean;
  has_dj_booths: boolean;
  available_cat6_runs: number;
  available_hma_runs: number;
  available_coax_runs: number;
  available_opticalcon_duo_runs: number;
  available_analog_runs: number;
}

export const compareArtistRequirements = (
  artist: ArtistRequirements,
  globalSetup: FestivalGearSetup | null,
  stageSetup: StageGearSetup | null
): ArtistGearComparison => {
  const mismatches: GearMismatch[] = [];
  
  // Determine which setup to use - stage-specific takes priority
  const availableGear: AvailableGear = stageSetup ? {
    foh_consoles: stageSetup.foh_consoles,
    mon_consoles: stageSetup.mon_consoles,
    wireless_systems: stageSetup.wireless_systems,
    iem_systems: stageSetup.iem_systems,
    wired_mics: stageSetup.wired_mics || [],
    available_monitors: stageSetup.monitors_quantity,
    has_side_fills: stageSetup.extras_sf,
    has_drum_fills: stageSetup.extras_df,
    has_dj_booths: stageSetup.extras_djbooth,
    available_cat6_runs: stageSetup.infra_cat6_quantity,
    available_hma_runs: stageSetup.infra_hma_quantity,
    available_coax_runs: stageSetup.infra_coax_quantity,
    available_opticalcon_duo_runs: stageSetup.infra_opticalcon_duo_quantity,
    available_analog_runs: stageSetup.infra_analog
  } : globalSetup ? {
    foh_consoles: globalSetup.foh_consoles,
    mon_consoles: globalSetup.mon_consoles,
    wireless_systems: globalSetup.wireless_systems,
    iem_systems: globalSetup.iem_systems,
    wired_mics: globalSetup.wired_mics || [],
    available_monitors: globalSetup.available_monitors,
    has_side_fills: globalSetup.has_side_fills,
    has_drum_fills: globalSetup.has_drum_fills,
    has_dj_booths: globalSetup.has_dj_booths,
    available_cat6_runs: globalSetup.available_cat6_runs,
    available_hma_runs: globalSetup.available_hma_runs,
    available_coax_runs: globalSetup.available_coax_runs,
    available_opticalcon_duo_runs: globalSetup.available_opticalcon_duo_runs,
    available_analog_runs: globalSetup.available_analog_runs
  } : {
    foh_consoles: [],
    mon_consoles: [],
    wireless_systems: [],
    iem_systems: [],
    wired_mics: [],
    available_monitors: 0,
    has_side_fills: false,
    has_drum_fills: false,
    has_dj_booths: false,
    available_cat6_runs: 0,
    available_hma_runs: 0,
    available_coax_runs: 0,
    available_opticalcon_duo_runs: 0,
    available_analog_runs: 0
  };

  // Check FOH Console availability
  if (artist.foh_console && artist.foh_console.trim() !== '') {
    const providedBy = artist.foh_console_provided_by || 'festival';
    
    if (providedBy === 'band') {
      mismatches.push({
        type: 'console',
        severity: 'warning',
        message: `Band bringing FOH Console "${artist.foh_console}"`
      });
    } else {
      const availableFohConsole = availableGear.foh_consoles.find(
        console => console.model.toLowerCase() === artist.foh_console.toLowerCase()
      );
      
      if (!availableFohConsole) {
        mismatches.push({
          type: 'console',
          severity: 'error',
          message: `FOH Console "${artist.foh_console}" not available`,
          details: `Available: ${availableGear.foh_consoles.map(c => c.model).join(', ') || 'None'}`
        });
      } else if (availableFohConsole.quantity < 1) {
        mismatches.push({
          type: 'console',
          severity: 'error',
          message: `FOH Console "${artist.foh_console}" out of stock`,
          details: `Available quantity: ${availableFohConsole.quantity}`
        });
      }
    }
  }

  // Check Monitor Console availability
  if (artist.mon_console && artist.mon_console.trim() !== '') {
    const providedBy = artist.mon_console_provided_by || 'festival';
    
    if (providedBy === 'band') {
      mismatches.push({
        type: 'console',
        severity: 'warning',
        message: `Band bringing Monitor Console "${artist.mon_console}"`
      });
    } else {
      const availableMonConsole = availableGear.mon_consoles.find(
        console => console.model.toLowerCase() === artist.mon_console.toLowerCase()
      );
      
      if (!availableMonConsole) {
        mismatches.push({
          type: 'console',
          severity: 'error',
          message: `Monitor Console "${artist.mon_console}" not available`,
          details: `Available: ${availableGear.mon_consoles.map(c => c.model).join(', ') || 'None'}`
        });
      } else if (availableMonConsole.quantity < 1) {
        mismatches.push({
          type: 'console',
          severity: 'error',
          message: `Monitor Console "${artist.mon_console}" out of stock`,
          details: `Available quantity: ${availableMonConsole.quantity}`
        });
      }
    }
  }

  // Check Wireless Systems
  if (artist.wireless_systems && artist.wireless_systems.length > 0) {
    const providedBy = artist.wireless_provided_by || 'festival';
    
    if (providedBy === 'band') {
      mismatches.push({
        type: 'wireless',
        severity: 'warning',
        message: `Band bringing wireless systems`
      });
    } else {
      artist.wireless_systems.forEach(artistWireless => {
        const availableWireless = availableGear.wireless_systems.find(
          w => w.model.toLowerCase() === artistWireless.model.toLowerCase()
        );
        
        if (!availableWireless) {
          mismatches.push({
            type: 'wireless',
            severity: 'error',
            message: `Wireless system "${artistWireless.model}" not available`,
            details: `Available: ${availableGear.wireless_systems.map(w => w.model).join(', ') || 'None'}`
          });
        } else {
          const requiredHH = artistWireless.quantity_hh || 0;
          const requiredBP = artistWireless.quantity_bp || 0;
          const availableHH = availableWireless.quantity_hh || 0;
          const availableBP = availableWireless.quantity_bp || 0;
          
          if (requiredHH > availableHH) {
            mismatches.push({
              type: 'wireless',
              severity: 'error',
              message: `Insufficient wireless handheld units for "${artistWireless.model}"`,
              details: `Required: ${requiredHH}, Available: ${availableHH}`
            });
          }
          
          if (requiredBP > availableBP) {
            mismatches.push({
              type: 'wireless',
              severity: 'error',
              message: `Insufficient wireless beltpack units for "${artistWireless.model}"`,
              details: `Required: ${requiredBP}, Available: ${availableBP}`
            });
          }
        }
      });
    }
  }

  // Check IEM Systems
  if (artist.iem_systems && artist.iem_systems.length > 0) {
    const providedBy = artist.iem_provided_by || 'festival';
    
    if (providedBy === 'band') {
      mismatches.push({
        type: 'iem',
        severity: 'warning',
        message: `Band bringing IEM systems`
      });
    } else {
      artist.iem_systems.forEach(artistIEM => {
        const availableIEM = availableGear.iem_systems.find(
          iem => iem.model.toLowerCase() === artistIEM.model.toLowerCase()
        );
        
        if (!availableIEM) {
          mismatches.push({
            type: 'iem',
            severity: 'error',
            message: `IEM system "${artistIEM.model}" not available`,
            details: `Available: ${availableGear.iem_systems.map(iem => iem.model).join(', ') || 'None'}`
          });
        } else {
          const requiredChannels = artistIEM.quantity_hh || artistIEM.quantity || 0;
          const requiredBP = artistIEM.quantity_bp || 0;
          const availableChannels = availableIEM.quantity_hh || availableIEM.quantity || 0;
          const availableBP = availableIEM.quantity_bp || 0;
          
          if (requiredChannels > availableChannels) {
            mismatches.push({
              type: 'iem',
              severity: 'error',
              message: `Insufficient IEM channels for "${artistIEM.model}"`,
              details: `Required: ${requiredChannels}, Available: ${availableChannels}`
            });
          }
          
          if (requiredBP > availableBP) {
            mismatches.push({
              type: 'iem',
              severity: 'error',
              message: `Insufficient IEM beltpacks for "${artistIEM.model}"`,
              details: `Required: ${requiredBP}, Available: ${availableBP}`
            });
          }
        }
      });
    }
  }

  // Check Wired Microphones
  if (artist.wired_mics && artist.wired_mics.length > 0) {
    const micKitProvider = artist.mic_kit || 'band';
    
    if (micKitProvider === 'band') {
      mismatches.push({
        type: 'wireless',
        severity: 'warning',
        message: `Band bringing microphone kit`
      });
    } else if (micKitProvider === 'festival' || micKitProvider === 'mixed') {
      artist.wired_mics.forEach(artistMic => {
        const availableMic = availableGear.wired_mics.find(
          mic => mic.model.toLowerCase() === artistMic.model.toLowerCase()
        );
        
        if (!availableMic) {
          mismatches.push({
            type: 'wireless',
            severity: 'error',
            message: `Wired microphone "${artistMic.model}" not available`,
            details: `Available: ${availableGear.wired_mics.map(m => m.model).join(', ') || 'None'}`
          });
        } else if (availableMic.quantity < artistMic.quantity) {
          mismatches.push({
            type: 'wireless',
            severity: 'error',
            message: `Insufficient "${artistMic.model}" microphones`,
            details: `Required: ${artistMic.quantity}, Available: ${availableMic.quantity}`
          });
        }
      });
      
      if (micKitProvider === 'mixed') {
        mismatches.push({
          type: 'wireless',
          severity: 'warning',
          message: `Mixed microphone setup - band providing additional mics`
        });
      }
    }
  }

  // Check Monitor quantity
  if (artist.monitors_enabled && artist.monitors_quantity > availableGear.available_monitors) {
    mismatches.push({
      type: 'monitors',
      severity: 'error',
      message: `Insufficient monitors`,
      details: `Required: ${artist.monitors_quantity}, Available: ${availableGear.available_monitors}`
    });
  }

  // Check Extras
  if (artist.extras_sf && !availableGear.has_side_fills) {
    mismatches.push({
      type: 'extras',
      severity: 'warning',
      message: `Side fills requested but not available`
    });
  }

  if (artist.extras_df && !availableGear.has_drum_fills) {
    mismatches.push({
      type: 'extras',
      severity: 'warning',
      message: `Drum fills requested but not available`
    });
  }

  if (artist.extras_djbooth && !availableGear.has_dj_booths) {
    mismatches.push({
      type: 'extras',
      severity: 'warning',
      message: `DJ booth requested but not available`
    });
  }

  // Check Infrastructure
  const infraProvidedBy = artist.infrastructure_provided_by || 'festival';
  
  if (infraProvidedBy === 'band') {
    mismatches.push({
      type: 'infrastructure',
      severity: 'warning',
      message: `Band bringing infrastructure`
    });
  } else {
    if (artist.infra_cat6 && (artist.infra_cat6_quantity || 0) > availableGear.available_cat6_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Insufficient CAT6 runs`,
        details: `Required: ${artist.infra_cat6_quantity || 0}, Available: ${availableGear.available_cat6_runs}`
      });
    }

    if (artist.infra_hma && (artist.infra_hma_quantity || 0) > availableGear.available_hma_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Insufficient HMA runs`,
        details: `Required: ${artist.infra_hma_quantity || 0}, Available: ${availableGear.available_hma_runs}`
      });
    }

    if (artist.infra_coax && (artist.infra_coax_quantity || 0) > availableGear.available_coax_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Insufficient Coax runs`,
        details: `Required: ${artist.infra_coax_quantity || 0}, Available: ${availableGear.available_coax_runs}`
      });
    }

    if (artist.infra_opticalcon_duo && (artist.infra_opticalcon_duo_quantity || 0) > availableGear.available_opticalcon_duo_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Insufficient OpticalCON DUO runs`,
        details: `Required: ${artist.infra_opticalcon_duo_quantity || 0}, Available: ${availableGear.available_opticalcon_duo_runs}`
      });
    }

    if ((artist.infra_analog || 0) > availableGear.available_analog_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Insufficient analog runs`,
        details: `Required: ${artist.infra_analog || 0}, Available: ${availableGear.available_analog_runs}`
      });
    }
  }

  return {
    artistName: artist.name,
    stage: artist.stage,
    mismatches,
    hasConflicts: mismatches.length > 0
  };
};

export const getMismatchSummary = (comparisons: ArtistGearComparison[]) => {
  const conflicts = comparisons.filter(c => c.hasConflicts);
  const errors = conflicts.reduce((sum, c) => sum + c.mismatches.filter(m => m.severity === 'error').length, 0);
  const warnings = conflicts.reduce((sum, c) => sum + c.mismatches.filter(m => m.severity === 'warning').length, 0);
  
  return {
    totalArtists: comparisons.length,
    artistsWithConflicts: conflicts.length,
    totalErrors: errors,
    totalWarnings: warnings,
    conflicts
  };
};
