import { ConsoleSetup, WirelessSetup, FestivalGearSetup, StageGearSetup, WiredMicSetup } from "@/types/festival";
import { getAvailableWirelessChannels, getRequiredWirelessChannels } from "@/lib/frequencyBands";

export interface GearMismatch {
  type: 'console' | 'wireless' | 'iem' | 'infrastructure' | 'extras' | 'monitors' | 'microphones';
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

export interface ArtistGearComparison {
  artistName: string;
  stage: number;
  mismatches: GearMismatch[];
  hasConflicts: boolean;
}

export interface EquipmentNeeds {
  consoles: {
    foh: Array<{ model: string; additionalQuantity: number; requiredBy: string[] }>;
    monitor: Array<{ model: string; additionalQuantity: number; requiredBy: string[] }>;
  };
  wireless: Array<{ model: string; additionalChannels: number; additionalHH: number; additionalBP: number; requiredBy: string[] }>;
  iem: Array<{ model: string; additionalChannels: number; additionalBP: number; requiredBy: string[] }>;
  microphones: Array<{ model: string; additionalQuantity: number; requiredBy: string[] }>;
  monitors: { additionalQuantity: number; requiredBy: string[] };
  infrastructure: {
    cat6: { additionalQuantity: number; requiredBy: string[] };
    hma: { additionalQuantity: number; requiredBy: string[] };
    coax: { additionalQuantity: number; requiredBy: string[] };
    opticalcon_duo: { additionalQuantity: number; requiredBy: string[] };
    analog: { additionalQuantity: number; requiredBy: string[] };
  };
  extras: {
    sideFills: { additionalStages: number; requiredBy: string[] };
    drumFills: { additionalStages: number; requiredBy: string[] };
    djBooths: { additionalStages: number; requiredBy: string[] };
  };
}

interface ArtistRequirements {
  name: string;
  stage: number;
  foh_console: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_from_foh?: boolean;
  foh_waves_outboard?: string;
  mon_waves_outboard?: string;
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
  foh_waves_outboard?: string | null;
  mon_waves_outboard?: string | null;
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

const EMPTY_AVAILABLE_GEAR: AvailableGear = {
  foh_consoles: [],
  mon_consoles: [],
  foh_waves_outboard: "",
  mon_waves_outboard: "",
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

const mapStageSetupToAvailableGear = (stageSetup: StageGearSetup): AvailableGear => ({
  foh_consoles: stageSetup.foh_consoles || [],
  mon_consoles: stageSetup.mon_consoles || [],
  foh_waves_outboard: stageSetup.foh_waves_outboard || "",
  mon_waves_outboard: stageSetup.mon_waves_outboard || "",
  wireless_systems: stageSetup.wireless_systems || [],
  iem_systems: stageSetup.iem_systems || [],
  wired_mics: stageSetup.wired_mics || [],
  available_monitors: stageSetup.monitors_quantity || 0,
  has_side_fills: stageSetup.extras_sf || false,
  has_drum_fills: stageSetup.extras_df || false,
  has_dj_booths: stageSetup.extras_djbooth || false,
  available_cat6_runs: stageSetup.infra_cat6_quantity || 0,
  available_hma_runs: stageSetup.infra_hma_quantity || 0,
  available_coax_runs: stageSetup.infra_coax_quantity || 0,
  available_opticalcon_duo_runs: stageSetup.infra_opticalcon_duo_quantity || 0,
  available_analog_runs: stageSetup.infra_analog || 0
});

const mapGlobalSetupToAvailableGear = (globalSetup: FestivalGearSetup): AvailableGear => ({
  foh_consoles: globalSetup.foh_consoles || [],
  mon_consoles: globalSetup.mon_consoles || [],
  foh_waves_outboard: globalSetup.foh_waves_outboard || "",
  mon_waves_outboard: globalSetup.mon_waves_outboard || "",
  wireless_systems: globalSetup.wireless_systems || [],
  iem_systems: globalSetup.iem_systems || [],
  wired_mics: globalSetup.wired_mics || [],
  available_monitors: globalSetup.available_monitors || 0,
  has_side_fills: globalSetup.has_side_fills || false,
  has_drum_fills: globalSetup.has_drum_fills || false,
  has_dj_booths: globalSetup.has_dj_booths || false,
  available_cat6_runs: globalSetup.available_cat6_runs || 0,
  available_hma_runs: globalSetup.available_hma_runs || 0,
  available_coax_runs: globalSetup.available_coax_runs || 0,
  available_opticalcon_duo_runs: globalSetup.available_opticalcon_duo_runs || 0,
  available_analog_runs: globalSetup.available_analog_runs || 0
});

export const compareArtistRequirements = (
  artist: ArtistRequirements,
  globalSetup: FestivalGearSetup | null,
  stageSetup: StageGearSetup | null
): ArtistGearComparison => {
  const mismatches: GearMismatch[] = [];

  // Stage 1 uses global setup. Other stages use only stage-specific setup; missing setup means empty inventory.
  const availableGear: AvailableGear = stageSetup
    ? mapStageSetupToAvailableGear(stageSetup)
    : artist.stage === 1 && globalSetup
      ? mapGlobalSetupToAvailableGear(globalSetup)
      : EMPTY_AVAILABLE_GEAR;

  // Check FOH Console availability
  if (artist.foh_console && artist.foh_console.trim() !== '') {
    const providedBy = artist.foh_console_provided_by || 'festival';
    
    if (providedBy === 'band') {
      mismatches.push({
        type: 'console',
        severity: 'info',
        message: `La banda aporta consola FOH "${artist.foh_console}"`
      });
    } else {
      const availableFohConsole = availableGear.foh_consoles.find(
        console => console.model.toLowerCase() === artist.foh_console.toLowerCase()
      );
      
      if (!availableFohConsole) {
        mismatches.push({
          type: 'console',
          severity: 'error',
          message: `Consola FOH "${artist.foh_console}" no disponible`,
          details: `Disponible: ${availableGear.foh_consoles.map(c => c.model).join(', ') || 'Ninguna'}`
        });
      } else if (availableFohConsole.quantity < 1) {
        mismatches.push({
          type: 'console',
          severity: 'error',
          message: `Consola FOH "${artist.foh_console}" sin stock`,
          details: `Cantidad disponible: ${availableFohConsole.quantity}`
        });
      }
    }
  }

  const normalizeText = (value: string | null | undefined) => (value || "").trim().toLowerCase();
  const artistFohWavesOutboard = (artist.foh_waves_outboard || "").trim();
  const availableFohWavesOutboard = (availableGear.foh_waves_outboard || "").trim();
  if (artistFohWavesOutboard.length > 0) {
    const fohProvidedBy = artist.foh_console_provided_by || 'festival';
    if (fohProvidedBy === 'band') {
      mismatches.push({
        type: 'console',
        severity: 'info',
        message: `La banda aporta Waves/Outboard FOH (${artistFohWavesOutboard})`
      });
    } else if (!availableFohWavesOutboard) {
      mismatches.push({
        type: 'console',
        severity: 'error',
        message: `Se solicita Waves/Outboard FOH pero no está configurado en el setup de equipo`,
      });
    } else {
      const normalizedNeed = normalizeText(artistFohWavesOutboard);
      const normalizedAvailable = normalizeText(availableFohWavesOutboard);
      if (
        normalizedNeed &&
        normalizedAvailable &&
        !normalizedAvailable.includes(normalizedNeed) &&
        !normalizedNeed.includes(normalizedAvailable)
      ) {
        mismatches.push({
          type: 'console',
          severity: 'warning',
          message: `La solicitud de Waves/Outboard FOH difiere del setup configurado`,
          details: `Solicitado: ${artistFohWavesOutboard}. Configurado: ${availableFohWavesOutboard}`
        });
      }
    }
  }

  // Check Monitor Console availability
  if (!artist.monitors_from_foh && artist.mon_console && artist.mon_console.trim() !== '') {
    const providedBy = artist.mon_console_provided_by || 'festival';
    
    if (providedBy === 'band') {
      mismatches.push({
        type: 'console',
        severity: 'info',
        message: `La banda aporta consola de monitores "${artist.mon_console}"`
      });
    } else {
      const availableMonConsole = availableGear.mon_consoles.find(
        console => console.model.toLowerCase() === artist.mon_console.toLowerCase()
      );
      
      if (!availableMonConsole) {
        mismatches.push({
          type: 'console',
          severity: 'error',
          message: `Consola de monitores "${artist.mon_console}" no disponible`,
          details: `Disponible: ${availableGear.mon_consoles.map(c => c.model).join(', ') || 'Ninguna'}`
        });
      } else if (availableMonConsole.quantity < 1) {
        mismatches.push({
          type: 'console',
          severity: 'error',
          message: `Consola de monitores "${artist.mon_console}" sin stock`,
          details: `Cantidad disponible: ${availableMonConsole.quantity}`
        });
      }
    }
  }

  const artistMonWavesOutboard = (artist.mon_waves_outboard || "").trim();
  const availableMonWavesOutboard = (availableGear.mon_waves_outboard || "").trim();
  if (!artist.monitors_from_foh && artistMonWavesOutboard.length > 0) {
    const monProvidedBy = artist.mon_console_provided_by || 'festival';
    if (monProvidedBy === 'band') {
      mismatches.push({
        type: 'console',
        severity: 'info',
        message: `La banda aporta Waves/Outboard MON (${artistMonWavesOutboard})`
      });
    } else if (!availableMonWavesOutboard) {
      mismatches.push({
        type: 'console',
        severity: 'error',
        message: `Se solicita Waves/Outboard MON pero no está configurado en el setup de equipo`,
      });
    } else {
      const normalizedNeed = normalizeText(artistMonWavesOutboard);
      const normalizedAvailable = normalizeText(availableMonWavesOutboard);
      if (
        normalizedNeed &&
        normalizedAvailable &&
        !normalizedAvailable.includes(normalizedNeed) &&
        !normalizedNeed.includes(normalizedAvailable)
      ) {
        mismatches.push({
          type: 'console',
          severity: 'warning',
          message: `La solicitud de Waves/Outboard MON difiere del setup configurado`,
          details: `Solicitado: ${artistMonWavesOutboard}. Configurado: ${availableMonWavesOutboard}`
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
        severity: 'info',
        message: `La banda aporta sistemas inalámbricos`
      });
    } else if (providedBy === 'mixed') {
      // Handle mixed setups: check each system individually
      let hasBandSystems = false;
      let hasFestivalSystems = false;
      
      artist.wireless_systems.forEach(artistWireless => {
        const systemProvider = artistWireless.provided_by || 'festival';
        
        if (systemProvider === 'band') {
          hasBandSystems = true;
        } else {
          hasFestivalSystems = true;
          
          // Only validate festival-provided systems against inventory
          const availableWireless = availableGear.wireless_systems.find(
            w => w.model.toLowerCase() === artistWireless.model.toLowerCase()
          );
          
          if (!availableWireless) {
            mismatches.push({
              type: 'wireless',
              severity: 'warning',
              message: `Sistema inalámbrico "${artistWireless.model}" no coincide con el setup`,
              details: `Setup configurado: ${availableGear.wireless_systems.map(w => w.model).join(', ') || 'Ninguno'}`
            });
          } else {
            const requiredChannels = getRequiredWirelessChannels(artistWireless);
            const availableChannels = getAvailableWirelessChannels(availableWireless);
            const requiredHH = artistWireless.quantity_hh || 0;
            const requiredBP = artistWireless.quantity_bp || 0;
            const availableHH = availableWireless.quantity_hh || 0;
            const availableBP = availableWireless.quantity_bp || 0;

            if (requiredChannels > availableChannels) {
              mismatches.push({
                type: 'wireless',
                severity: 'error',
                message: `Canales RF insuficientes para "${artistWireless.model}"`,
                details: `Requiere: ${requiredChannels}, Disponible: ${availableChannels}`
              });
            }
            
            if (requiredHH > availableHH) {
              mismatches.push({
                type: 'wireless',
                severity: 'error',
                message: `Unidades inalámbricas de mano insuficientes para "${artistWireless.model}"`,
                details: `Requiere: ${requiredHH}, Disponible: ${availableHH}`
              });
            }
            
            if (requiredBP > availableBP) {
              mismatches.push({
                type: 'wireless',
                severity: 'error',
                message: `Petacas inalámbricas insuficientes para "${artistWireless.model}"`,
                details: `Requiere: ${requiredBP}, Disponible: ${availableBP}`
              });
            }
          }
        }
      });
      
      // Add informational note for mixed setup
      if (hasBandSystems && hasFestivalSystems) {
        mismatches.push({
          type: 'wireless',
          severity: 'info',
          message: `Configuración inalámbrica mixta: la banda aporta parte de los sistemas`
        });
      }
    } else {
      // Festival-only setup: validate all systems
      artist.wireless_systems.forEach(artistWireless => {
        const availableWireless = availableGear.wireless_systems.find(
          w => w.model.toLowerCase() === artistWireless.model.toLowerCase()
        );

        if (!availableWireless) {
          mismatches.push({
            type: 'wireless',
            severity: 'warning',
            message: `Sistema inalámbrico "${artistWireless.model}" no coincide con el setup`,
            details: `Setup configurado: ${availableGear.wireless_systems.map(w => w.model).join(', ') || 'Ninguno'}`
          });
        } else {
          const requiredChannels = getRequiredWirelessChannels(artistWireless);
          const availableChannels = getAvailableWirelessChannels(availableWireless);
          const requiredHH = artistWireless.quantity_hh || 0;
          const requiredBP = artistWireless.quantity_bp || 0;
          const availableHH = availableWireless.quantity_hh || 0;
          const availableBP = availableWireless.quantity_bp || 0;

          if (requiredChannels > availableChannels) {
            mismatches.push({
              type: 'wireless',
              severity: 'error',
              message: `Canales RF insuficientes para "${artistWireless.model}"`,
              details: `Requiere: ${requiredChannels}, Disponible: ${availableChannels}`
            });
          }
          
          if (requiredHH > availableHH) {
            mismatches.push({
              type: 'wireless',
              severity: 'error',
              message: `Unidades inalámbricas de mano insuficientes para "${artistWireless.model}"`,
              details: `Requiere: ${requiredHH}, Disponible: ${availableHH}`
            });
          }
          
          if (requiredBP > availableBP) {
            mismatches.push({
              type: 'wireless',
              severity: 'error',
              message: `Petacas inalámbricas insuficientes para "${artistWireless.model}"`,
              details: `Requiere: ${requiredBP}, Disponible: ${availableBP}`
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
        severity: 'info',
        message: `La banda aporta sistemas IEM`
      });
    } else if (providedBy === 'mixed') {
      // Handle mixed setups: check each system individually
      let hasBandSystems = false;
      let hasFestivalSystems = false;
      
      artist.iem_systems.forEach(artistIEM => {
        const systemProvider = artistIEM.provided_by || 'festival';
        
        if (systemProvider === 'band') {
          hasBandSystems = true;
        } else {
          hasFestivalSystems = true;
          
          // Only validate festival-provided systems against inventory
          const availableIEM = availableGear.iem_systems.find(
            iem => iem.model.toLowerCase() === artistIEM.model.toLowerCase()
          );
          
          if (!availableIEM) {
            mismatches.push({
              type: 'iem',
              severity: 'warning',
              message: `Sistema IEM "${artistIEM.model}" no coincide con el setup`,
              details: `Setup configurado: ${availableGear.iem_systems.map(iem => iem.model).join(', ') || 'Ninguno'}`
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
                message: `Canales IEM insuficientes para "${artistIEM.model}"`,
                details: `Requiere: ${requiredChannels}, Disponible: ${availableChannels}`
              });
            }
            
            if (requiredBP > availableBP) {
              mismatches.push({
                type: 'iem',
                severity: 'error',
                message: `Petacas IEM insuficientes para "${artistIEM.model}"`,
                details: `Requiere: ${requiredBP}, Disponible: ${availableBP}`
              });
            }
          }
        }
      });
      
      // Add informational note for mixed setup
      if (hasBandSystems && hasFestivalSystems) {
        mismatches.push({
          type: 'iem',
          severity: 'info',
          message: `Configuración IEM mixta: la banda aporta parte de los sistemas`
        });
      }
    } else {
      // Festival-only setup: validate all systems
      artist.iem_systems.forEach(artistIEM => {
        const availableIEM = availableGear.iem_systems.find(
          iem => iem.model.toLowerCase() === artistIEM.model.toLowerCase()
        );

        if (!availableIEM) {
          mismatches.push({
            type: 'iem',
            severity: 'warning',
            message: `Sistema IEM "${artistIEM.model}" no coincide con el setup`,
            details: `Setup configurado: ${availableGear.iem_systems.map(iem => iem.model).join(', ') || 'Ninguno'}`
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
              message: `Canales IEM insuficientes para "${artistIEM.model}"`,
              details: `Requiere: ${requiredChannels}, Disponible: ${availableChannels}`
            });
          }
          
          if (requiredBP > availableBP) {
            mismatches.push({
              type: 'iem',
              severity: 'error',
              message: `Petacas IEM insuficientes para "${artistIEM.model}"`,
              details: `Requiere: ${requiredBP}, Disponible: ${availableBP}`
            });
          }
        }
      });
    }
  }

  // Wired Microphone Check
  const micKitProvider = artist.mic_kit || 'band';
  const artistHasMicRequirements = artist.wired_mics && Array.isArray(artist.wired_mics) && artist.wired_mics.length > 0;
  const festivalHasMics = availableGear.wired_mics && Array.isArray(availableGear.wired_mics) && availableGear.wired_mics.length > 0;

  if (micKitProvider === 'band') {
    if (artistHasMicRequirements) {
      mismatches.push({
        type: 'microphones',
        severity: 'info',
        message: `La banda aporta kit de micrófonos (${artist.wired_mics?.length || 0} tipos de micro)`
      });
    } else {
      mismatches.push({
        type: 'microphones',
        severity: 'info',
        message: `La banda aporta kit de micrófonos`
      });
    }
  } else if (micKitProvider === 'festival' || micKitProvider === 'mixed') {
    if (artistHasMicRequirements) {
      if (!festivalHasMics) {
        mismatches.push({
          type: 'microphones',
          severity: 'error',
          message: `Se requieren micrófonos de festival pero no hay ninguno configurado`,
          details: `El artista necesita ${artist.wired_mics?.length || 0} tipos de micro, pero el festival no tiene micros disponibles`
        });
      } else {
        artist.wired_mics?.forEach((artistMic) => {
          const availableMic = availableGear.wired_mics.find(
            mic => mic.model.toLowerCase() === artistMic.model.toLowerCase()
          );
          if (!availableMic) {
            mismatches.push({
              type: 'microphones',
              severity: 'error',
              message: `Micrófono cableado "${artistMic.model}" no disponible`,
              details: `Disponible: ${availableGear.wired_mics.map(m => m.model).join(', ') || 'Ninguno'}`
            });
          } else if (availableMic.quantity < artistMic.quantity) {
            mismatches.push({
              type: 'microphones',
              severity: 'error',
              message: `Micrófonos "${artistMic.model}" insuficientes`,
              details: `Requiere: ${artistMic.quantity}, Disponible: ${availableMic.quantity}`
            });
          }
        });
      }
      if (micKitProvider === 'mixed') {
        mismatches.push({
          type: 'microphones',
          severity: 'info',
          message: `Configuración de micrófonos mixta: la banda aporta micros adicionales`
        });
      }
    } else if (micKitProvider === 'festival') {
      if (!festivalHasMics) {
        mismatches.push({
          type: 'microphones',
          severity: 'warning',
          message: `Se espera kit de micrófonos de festival, pero no hay ninguno configurado`
        });
      }
    }
  }

  // Check Monitor quantity
  if (artist.monitors_enabled && artist.monitors_quantity > availableGear.available_monitors) {
    mismatches.push({
      type: 'monitors',
      severity: 'error',
      message: `Monitores insuficientes`,
      details: `Requiere: ${artist.monitors_quantity}, Disponible: ${availableGear.available_monitors}`
    });
  }

  // Check Extras
  if (artist.extras_sf && !availableGear.has_side_fills) {
    mismatches.push({
      type: 'extras',
      severity: 'warning',
      message: `Se solicitan side fills, pero no están disponibles`
    });
  }

  if (artist.extras_df && !availableGear.has_drum_fills) {
    mismatches.push({
      type: 'extras',
      severity: 'warning',
      message: `Se solicitan drum fills, pero no están disponibles`
    });
  }

  if (artist.extras_djbooth && !availableGear.has_dj_booths) {
    mismatches.push({
      type: 'extras',
      severity: 'warning',
      message: `Se solicita cabina DJ, pero no está disponible`
    });
  }

  // Check Infrastructure
  const infraProvidedBy = artist.infrastructure_provided_by || 'festival';
  
  if (infraProvidedBy === 'band') {
    mismatches.push({
      type: 'infrastructure',
      severity: 'info',
      message: `La banda aporta infraestructura`
    });
  } else {
    if (artist.infra_cat6 && (artist.infra_cat6_quantity || 0) > availableGear.available_cat6_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Tiradas CAT6 insuficientes`,
        details: `Requiere: ${artist.infra_cat6_quantity || 0}, Disponible: ${availableGear.available_cat6_runs}`
      });
    }

    if (artist.infra_hma && (artist.infra_hma_quantity || 0) > availableGear.available_hma_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Tiradas HMA insuficientes`,
        details: `Requiere: ${artist.infra_hma_quantity || 0}, Disponible: ${availableGear.available_hma_runs}`
      });
    }

    if (artist.infra_coax && (artist.infra_coax_quantity || 0) > availableGear.available_coax_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Tiradas coaxiales insuficientes`,
        details: `Requiere: ${artist.infra_coax_quantity || 0}, Disponible: ${availableGear.available_coax_runs}`
      });
    }

    if (artist.infra_opticalcon_duo && (artist.infra_opticalcon_duo_quantity || 0) > availableGear.available_opticalcon_duo_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Tiradas OpticalCON DUO insuficientes`,
        details: `Requiere: ${artist.infra_opticalcon_duo_quantity || 0}, Disponible: ${availableGear.available_opticalcon_duo_runs}`
      });
    }

    if ((artist.infra_analog || 0) > availableGear.available_analog_runs) {
      mismatches.push({
        type: 'infrastructure',
        severity: 'error',
        message: `Tiradas analógicas insuficientes`,
        details: `Requiere: ${artist.infra_analog || 0}, Disponible: ${availableGear.available_analog_runs}`
      });
    }
  }

  return {
    artistName: artist.name,
    stage: artist.stage,
    mismatches,
    hasConflicts: mismatches.some(m => m.severity === 'error' || m.severity === 'warning')
  };
};

export const calculateEquipmentNeeds = (
  artists: ArtistRequirements[],
  globalSetup: FestivalGearSetup | null,
  stageSetups: Record<number, StageGearSetup>
): EquipmentNeeds => {
  const needs: EquipmentNeeds = {
    consoles: { foh: [], monitor: [] },
    wireless: [],
    iem: [],
    microphones: [],
    monitors: { additionalQuantity: 0, requiredBy: [] },
    infrastructure: {
      cat6: { additionalQuantity: 0, requiredBy: [] },
      hma: { additionalQuantity: 0, requiredBy: [] },
      coax: { additionalQuantity: 0, requiredBy: [] },
      opticalcon_duo: { additionalQuantity: 0, requiredBy: [] },
      analog: { additionalQuantity: 0, requiredBy: [] }
    },
    extras: {
      sideFills: { additionalStages: 0, requiredBy: [] },
      drumFills: { additionalStages: 0, requiredBy: [] },
      djBooths: { additionalStages: 0, requiredBy: [] }
    }
  };

  // Group artists by stage and calculate total requirements
  const stageRequirements: Record<number, {
    fohConsoles: Record<string, number>;
    monConsoles: Record<string, number>;
    wireless: Record<string, { channels: number; hh: number; bp: number }>;
    iem: Record<string, { channels: number; bp: number }>;
    microphones: Record<string, number>;
    monitors: number;
    infrastructure: {
      cat6: number;
      hma: number;
      coax: number;
      opticalcon_duo: number;
      analog: number;
    };
    extras: {
      sideFills: boolean;
      drumFills: boolean;
      djBooths: boolean;
    };
  }> = {};

  // Initialize stage requirements
  artists.forEach(artist => {
    if (!stageRequirements[artist.stage]) {
      stageRequirements[artist.stage] = {
        fohConsoles: {},
        monConsoles: {},
        wireless: {},
        iem: {},
        microphones: {},
        monitors: 0,
        infrastructure: { cat6: 0, hma: 0, coax: 0, opticalcon_duo: 0, analog: 0 },
        extras: { sideFills: false, drumFills: false, djBooths: false }
      };
    }
  });

  // Calculate cumulative requirements per stage
  artists.forEach(artist => {
    const stageReq = stageRequirements[artist.stage];

    // Only count festival-provided equipment
    
    // FOH Console
    if (artist.foh_console && artist.foh_console_provided_by !== 'band') {
      stageReq.fohConsoles[artist.foh_console] = (stageReq.fohConsoles[artist.foh_console] || 0) + 1;
    }

    // Monitor Console
    if (!artist.monitors_from_foh && artist.mon_console && artist.mon_console_provided_by !== 'band') {
      stageReq.monConsoles[artist.mon_console] = (stageReq.monConsoles[artist.mon_console] || 0) + 1;
    }

    // Wireless (only festival-provided)
    if (artist.wireless_systems && artist.wireless_provided_by !== 'band') {
      artist.wireless_systems.forEach(system => {
        if (system.provided_by !== 'band') {
          const key = system.model;
          if (!stageReq.wireless[key]) {
            stageReq.wireless[key] = { channels: 0, hh: 0, bp: 0 };
          }
          stageReq.wireless[key].channels += getRequiredWirelessChannels(system);
          stageReq.wireless[key].hh += system.quantity_hh || 0;
          stageReq.wireless[key].bp += system.quantity_bp || 0;
        }
      });
    }

    // IEM (only festival-provided)
    if (artist.iem_systems && artist.iem_provided_by !== 'band') {
      artist.iem_systems.forEach(system => {
        if (system.provided_by !== 'band') {
          const key = system.model;
          if (!stageReq.iem[key]) {
            stageReq.iem[key] = { channels: 0, bp: 0 };
          }
          stageReq.iem[key].channels += system.quantity_hh || system.quantity || 0;
          stageReq.iem[key].bp += system.quantity_bp || 0;
        }
      });
    }

    // Microphones (only festival-provided)
    if (artist.wired_mics && (artist.mic_kit === 'festival' || artist.mic_kit === 'mixed')) {
      artist.wired_mics.forEach(mic => {
        stageReq.microphones[mic.model] = (stageReq.microphones[mic.model] || 0) + mic.quantity;
      });
    }

    // Monitors
    if (artist.monitors_enabled) {
      stageReq.monitors += artist.monitors_quantity || 0;
    }

    // Infrastructure (only festival-provided)
    if (artist.infrastructure_provided_by !== 'band') {
      if (artist.infra_cat6) {
        stageReq.infrastructure.cat6 += artist.infra_cat6_quantity || 0;
      }
      if (artist.infra_hma) {
        stageReq.infrastructure.hma += artist.infra_hma_quantity || 0;
      }
      if (artist.infra_coax) {
        stageReq.infrastructure.coax += artist.infra_coax_quantity || 0;
      }
      if (artist.infra_opticalcon_duo) {
        stageReq.infrastructure.opticalcon_duo += artist.infra_opticalcon_duo_quantity || 0;
      }
      if (artist.infra_analog) {
        stageReq.infrastructure.analog += artist.infra_analog || 0;
      }
    }

    // Extras
    if (artist.extras_sf) stageReq.extras.sideFills = true;
    if (artist.extras_df) stageReq.extras.drumFills = true;
    if (artist.extras_djbooth) stageReq.extras.djBooths = true;
  });

  // Calculate shortfalls for each stage
  Object.entries(stageRequirements).forEach(([stageNum, requirements]) => {
    const stage = parseInt(stageNum);
    const stageSetup = stageSetups[stage];
    const availableGear: AvailableGear = stageSetup
      ? mapStageSetupToAvailableGear(stageSetup)
      : stage === 1 && globalSetup
        ? mapGlobalSetupToAvailableGear(globalSetup)
        : EMPTY_AVAILABLE_GEAR;

    // FOH Console shortfalls
    Object.entries(requirements.fohConsoles).forEach(([model, required]) => {
      const available = availableGear.foh_consoles.find(c => c.model === model)?.quantity || 0;
      const shortage = Math.max(0, required - available);
      if (shortage > 0) {
        const existing = needs.consoles.foh.find(c => c.model === model);
        if (existing) {
          existing.additionalQuantity += shortage;
          if (!existing.requiredBy.includes(`Stage ${stage}`)) {
            existing.requiredBy.push(`Stage ${stage}`);
          }
        } else {
          needs.consoles.foh.push({
            model,
            additionalQuantity: shortage,
            requiredBy: [`Stage ${stage}`]
          });
        }
      }
    });

    // Monitor Console shortfalls
    Object.entries(requirements.monConsoles).forEach(([model, required]) => {
      const available = availableGear.mon_consoles.find(c => c.model === model)?.quantity || 0;
      const shortage = Math.max(0, required - available);
      if (shortage > 0) {
        const existing = needs.consoles.monitor.find(c => c.model === model);
        if (existing) {
          existing.additionalQuantity += shortage;
          if (!existing.requiredBy.includes(`Stage ${stage}`)) {
            existing.requiredBy.push(`Stage ${stage}`);
          }
        } else {
          needs.consoles.monitor.push({
            model,
            additionalQuantity: shortage,
            requiredBy: [`Stage ${stage}`]
          });
        }
      }
    });

    // Wireless shortfalls
    Object.entries(requirements.wireless).forEach(([model, required]) => {
      const available = availableGear.wireless_systems.find(w => w.model === model);
      const availableChannels = available ? getAvailableWirelessChannels(available) : 0;
      const availableHH = available?.quantity_hh || 0;
      const availableBP = available?.quantity_bp || 0;
      const shortageChannels = Math.max(0, required.channels - availableChannels);
      const shortageHH = Math.max(0, required.hh - availableHH);
      const shortageBP = Math.max(0, required.bp - availableBP);
      
      if (shortageChannels > 0 || shortageHH > 0 || shortageBP > 0) {
        const existing = needs.wireless.find(w => w.model === model);
        if (existing) {
          existing.additionalChannels += shortageChannels;
          existing.additionalHH += shortageHH;
          existing.additionalBP += shortageBP;
          if (!existing.requiredBy.includes(`Stage ${stage}`)) {
            existing.requiredBy.push(`Stage ${stage}`);
          }
        } else {
          needs.wireless.push({
            model,
            additionalChannels: shortageChannels,
            additionalHH: shortageHH,
            additionalBP: shortageBP,
            requiredBy: [`Stage ${stage}`]
          });
        }
      }
    });

    // IEM shortfalls
    Object.entries(requirements.iem).forEach(([model, required]) => {
      const available = availableGear.iem_systems.find(i => i.model === model);
      const availableChannels = available?.quantity_hh || available?.quantity || 0;
      const availableBP = available?.quantity_bp || 0;
      const shortageChannels = Math.max(0, required.channels - availableChannels);
      const shortageBP = Math.max(0, required.bp - availableBP);
      
      if (shortageChannels > 0 || shortageBP > 0) {
        const existing = needs.iem.find(i => i.model === model);
        if (existing) {
          existing.additionalChannels += shortageChannels;
          existing.additionalBP += shortageBP;
          if (!existing.requiredBy.includes(`Stage ${stage}`)) {
            existing.requiredBy.push(`Stage ${stage}`);
          }
        } else {
          needs.iem.push({
            model,
            additionalChannels: shortageChannels,
            additionalBP: shortageBP,
            requiredBy: [`Stage ${stage}`]
          });
        }
      }
    });

    // Microphone shortfalls
    Object.entries(requirements.microphones).forEach(([model, required]) => {
      const available = availableGear.wired_mics.find(m => m.model === model)?.quantity || 0;
      const shortage = Math.max(0, required - available);
      if (shortage > 0) {
        const existing = needs.microphones.find(m => m.model === model);
        if (existing) {
          existing.additionalQuantity += shortage;
          if (!existing.requiredBy.includes(`Stage ${stage}`)) {
            existing.requiredBy.push(`Stage ${stage}`);
          }
        } else {
          needs.microphones.push({
            model,
            additionalQuantity: shortage,
            requiredBy: [`Stage ${stage}`]
          });
        }
      }
    });

    // Monitor shortfalls  
    const monitorShortage = Math.max(0, requirements.monitors - availableGear.available_monitors);
    if (monitorShortage > 0) {
      needs.monitors.additionalQuantity += monitorShortage;
      if (!needs.monitors.requiredBy.includes(`Stage ${stage}`)) {
        needs.monitors.requiredBy.push(`Stage ${stage}`);
      }
    }

    // Infrastructure shortfalls
    const infraShortages = {
      cat6: Math.max(0, requirements.infrastructure.cat6 - availableGear.available_cat6_runs),
      hma: Math.max(0, requirements.infrastructure.hma - availableGear.available_hma_runs),
      coax: Math.max(0, requirements.infrastructure.coax - availableGear.available_coax_runs),
      opticalcon_duo: Math.max(0, requirements.infrastructure.opticalcon_duo - availableGear.available_opticalcon_duo_runs),
      analog: Math.max(0, requirements.infrastructure.analog - availableGear.available_analog_runs)
    };

    Object.entries(infraShortages).forEach(([type, shortage]) => {
      if (shortage > 0) {
        const infraType = type as keyof typeof needs.infrastructure;
        needs.infrastructure[infraType].additionalQuantity += shortage;
        if (!needs.infrastructure[infraType].requiredBy.includes(`Stage ${stage}`)) {
          needs.infrastructure[infraType].requiredBy.push(`Stage ${stage}`);
        }
      }
    });

    // Extras shortfalls
    if (requirements.extras.sideFills && !availableGear.has_side_fills) {
      needs.extras.sideFills.additionalStages += 1;
      if (!needs.extras.sideFills.requiredBy.includes(`Stage ${stage}`)) {
        needs.extras.sideFills.requiredBy.push(`Stage ${stage}`);
      }
    }
    if (requirements.extras.drumFills && !availableGear.has_drum_fills) {
      needs.extras.drumFills.additionalStages += 1;
      if (!needs.extras.drumFills.requiredBy.includes(`Stage ${stage}`)) {
        needs.extras.drumFills.requiredBy.push(`Stage ${stage}`);
      }
    }
    if (requirements.extras.djBooths && !availableGear.has_dj_booths) {
      needs.extras.djBooths.additionalStages += 1;
      if (!needs.extras.djBooths.requiredBy.includes(`Stage ${stage}`)) {
        needs.extras.djBooths.requiredBy.push(`Stage ${stage}`);
      }
    }
  });

  return needs;
};

export const getMismatchSummary = (comparisons: ArtistGearComparison[]) => {
  const totalArtists = comparisons.length;
  const artistsWithConflicts = comparisons.filter(c => c.hasConflicts).length;
  const totalErrors = comparisons.reduce((sum, c) => sum + c.mismatches.filter(m => m.severity === 'error').length, 0);
  const totalWarnings = comparisons.reduce((sum, c) => sum + c.mismatches.filter(m => m.severity === 'warning').length, 0);
  
  const conflicts = comparisons
    .filter(c => c.hasConflicts)
    .map(c => ({
      artist: c.artistName,
      stage: c.stage,
      mismatches: c.mismatches
    }));

  return {
    totalArtists,
    artistsWithConflicts,
    totalErrors,
    totalWarnings,
    conflicts
  };
};
