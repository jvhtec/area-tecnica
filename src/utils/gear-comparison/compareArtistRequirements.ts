import { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import { getAvailableWirelessChannels, getRequiredWirelessChannels } from "@/lib/frequencyBands";
import type { GearMismatch, ArtistGearComparison, ArtistRequirements, AvailableGear } from "./types";
import { EMPTY_AVAILABLE_GEAR, mapStageSetupToAvailableGear, mapGlobalSetupToAvailableGear } from "./availableGear";

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
