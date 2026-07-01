import { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import { getAvailableWirelessChannels, getRequiredWirelessChannels } from "@/lib/frequencyBands";
import type { GearMismatch, ArtistGearComparison, ArtistRequirements, AvailableGear } from "@/utils/gear-comparison/types";
import { EMPTY_AVAILABLE_GEAR, mapStageSetupToAvailableGear, mapGlobalSetupToAvailableGear } from "@/utils/gear-comparison/availableGear";
import {
  canSubstituteWavesModel,
  formatWavesModelSelections,
  normalizeWavesModelSelections,
  WAVES_POWER_RANK,
  type WavesModelSelection,
} from "@/constants/wavesModels";
import { FOH_DRIVE_LABELS, CONSOLE_POSITION_LABELS } from "@/constants/consoleDrive";

type WavesCheckArgs = {
  label: string;
  artistModels: WavesModelSelection[] | undefined;
  availableModels: WavesModelSelection[] | undefined;
};

type EnumMembershipCheckArgs = {
  label: string;
  required: string | undefined;
  available: string[] | undefined;
  labels: Record<string, string>;
};

// Generic "is the required option among what the festival supports" check,
// used for FOH drive, FOH drive position, and MON position: no options
// configured at all is an error, and a required option outside the
// configured set is also an error (no substitutability concept for these).
const checkEnumMembership = ({ label, required, available, labels }: EnumMembershipCheckArgs): GearMismatch | null => {
  if (!required) return null;

  const configured = available || [];
  if (configured.length === 0) {
    return {
      type: 'console',
      severity: 'error',
      message: `Se solicita ${label} pero no está configurado en el setup de equipo`,
      details: `Solicitado: ${labels[required] || required}`,
    };
  }

  if (!configured.includes(required)) {
    return {
      type: 'console',
      severity: 'error',
      message: `${label} solicitado no coincide con el configurado`,
      details: `Solicitado: ${labels[required] || required}. Configurado: ${configured.map((value) => labels[value] || value).join(', ')}`,
    };
  }

  return null;
};

// Shared FOH/MON waves model comparison: no model configured on the festival
// side is an error; insufficient quantity of an otherwise-matching (or
// substitutable) model is an error; covering a requirement with a
// substitutable-but-different model (e.g. a Titan covering a Server One
// requirement) is a warning; a model from an incompatible family (e.g.
// Livebox/Fourier vs the SoundGrid family, or a Server One trying to cover a
// Titan requirement) is an error since it can't be substituted.
const checkWavesModels = ({ label, artistModels, availableModels }: WavesCheckArgs): GearMismatch | null => {
  const required = normalizeWavesModelSelections(artistModels);
  if (required.length === 0) return null;

  const available = normalizeWavesModelSelections(availableModels);
  if (available.length === 0) {
    return {
      type: 'console',
      severity: 'error',
      message: `Se solicita servidor Waves ${label} pero no está configurado en el setup de equipo`,
      details: `Solicitado: ${formatWavesModelSelections(required)}`,
    };
  }

  // Greedy allocation from a shared pool: satisfy the most demanding (highest
  // power tier) requirements first, taking an exact-model match before
  // reaching for a more powerful substitute, and preferring the smallest
  // sufficient substitute to leave bigger units free for other needs.
  const pool = new Map(available.map((selection) => [selection.model, selection.quantity]));
  const orderedRequired = [...required].sort(
    (a, b) => (WAVES_POWER_RANK[b.model] || 0) - (WAVES_POWER_RANK[a.model] || 0)
  );

  const insufficient: WavesModelSelection[] = [];
  const incompatibleModels = new Set<string>();
  let usedSubstitute = false;

  orderedRequired.forEach((requiredSelection) => {
    let remaining = requiredSelection.quantity;

    const exact = pool.get(requiredSelection.model) || 0;
    const takeExact = Math.min(exact, remaining);
    if (takeExact > 0) {
      pool.set(requiredSelection.model, exact - takeExact);
      remaining -= takeExact;
    }

    if (remaining > 0) {
      const substitutes = Array.from(pool.entries())
        .filter(([model, quantity]) => quantity > 0 && model !== requiredSelection.model && canSubstituteWavesModel(requiredSelection.model, model))
        .sort((a, b) => (WAVES_POWER_RANK[a[0]] || 0) - (WAVES_POWER_RANK[b[0]] || 0));

      substitutes.forEach(([model, quantity]) => {
        if (remaining <= 0) return;
        const take = Math.min(quantity, remaining);
        pool.set(model, quantity - take);
        remaining -= take;
        usedSubstitute = true;
      });
    }

    if (remaining > 0) {
      insufficient.push({ model: requiredSelection.model, quantity: remaining });
      const hasAnyCompatible = available.some(
        (availableSelection) => canSubstituteWavesModel(requiredSelection.model, availableSelection.model)
      );
      if (!hasAnyCompatible) incompatibleModels.add(requiredSelection.model);
    }
  });

  if (insufficient.length > 0) {
    const allIncompatible = insufficient.every((selection) => incompatibleModels.has(selection.model));
    return {
      type: 'console',
      severity: 'error',
      message: allIncompatible
        ? `El servidor Waves ${label} solicitado no es compatible con el configurado`
        : `Servidores Waves ${label} insuficientes`,
      details: `Faltan: ${formatWavesModelSelections(insufficient)}. Configurado: ${formatWavesModelSelections(available)}`,
    };
  }

  if (!usedSubstitute) return null;

  return {
    type: 'console',
    severity: 'warning',
    message: `El servidor Waves ${label} solicitado difiere del configurado`,
    details: `Solicitado: ${formatWavesModelSelections(required)}. Configurado: ${formatWavesModelSelections(available)}`,
  };
};

export const compareArtistRequirements = (
  artist: ArtistRequirements,
  globalSetup: FestivalGearSetup | null,
  stageSetup: StageGearSetup | null
): ArtistGearComparison => {
  const mismatches: GearMismatch[] = [];

  // Stage 1 is the inherited single/global setup: it always resolves from the
  // global festival setup (or empty if absent) and never reads a stage-specific
  // row. Other stages use their stage-specific setup; missing setup means empty.
  const availableGear: AvailableGear = artist.stage === 1
    ? (globalSetup ? mapGlobalSetupToAvailableGear(globalSetup) : EMPTY_AVAILABLE_GEAR)
    : stageSetup
      ? mapStageSetupToAvailableGear(stageSetup)
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

  const fohDriveMismatch = checkEnumMembership({
    label: 'Drive FOH',
    required: artist.foh_drive || undefined,
    available: availableGear.foh_drive_options,
    labels: FOH_DRIVE_LABELS,
  });
  if (fohDriveMismatch) mismatches.push(fohDriveMismatch);

  const fohDrivePositionMismatch = checkEnumMembership({
    label: 'posición del drive FOH',
    required: artist.foh_drive_position || undefined,
    available: availableGear.foh_drive_positions,
    labels: CONSOLE_POSITION_LABELS,
  });
  if (fohDrivePositionMismatch) mismatches.push(fohDrivePositionMismatch);

  const fohWavesProvidedBy = artist.foh_waves_provided_by || 'festival';
  if ((artist.foh_waves_models || []).length > 0 || (artist.foh_outboard || "").trim().length > 0) {
    if (fohWavesProvidedBy === 'band') {
      mismatches.push({
        type: 'console',
        severity: 'info',
        message: `La banda aporta Waves/Outboard FOH${artist.foh_waves_models?.length ? ` (${formatWavesModelSelections(artist.foh_waves_models)})` : ''}`
      });
    } else {
      const wavesMismatch = checkWavesModels({
        label: 'FOH',
        artistModels: artist.foh_waves_models,
        availableModels: availableGear.foh_waves_models,
      });
      if (wavesMismatch) mismatches.push(wavesMismatch);
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

  if (!artist.monitors_from_foh) {
    const monPositionMismatch = checkEnumMembership({
      label: 'posición de monitores',
      required: artist.mon_position || undefined,
      available: availableGear.mon_positions,
      labels: CONSOLE_POSITION_LABELS,
    });
    if (monPositionMismatch) mismatches.push(monPositionMismatch);
  }

  const monWavesProvidedBy = artist.mon_waves_provided_by || 'festival';
  if (!artist.monitors_from_foh && ((artist.mon_waves_models || []).length > 0 || (artist.mon_outboard || "").trim().length > 0)) {
    if (monWavesProvidedBy === 'band') {
      mismatches.push({
        type: 'console',
        severity: 'info',
        message: `La banda aporta Waves/Outboard MON${artist.mon_waves_models?.length ? ` (${formatWavesModelSelections(artist.mon_waves_models)})` : ''}`
      });
    } else {
      const wavesMismatch = checkWavesModels({
        label: 'MON',
        artistModels: artist.mon_waves_models,
        availableModels: availableGear.mon_waves_models,
      });
      if (wavesMismatch) mismatches.push(wavesMismatch);
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
