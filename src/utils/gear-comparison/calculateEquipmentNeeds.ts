import { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import { getAvailableWirelessChannels, getRequiredWirelessChannels } from "@/lib/frequencyBands";
import type { EquipmentNeeds, ArtistRequirements, AvailableGear } from "@/utils/gear-comparison/types";
import { EMPTY_AVAILABLE_GEAR, mapStageSetupToAvailableGear, mapGlobalSetupToAvailableGear } from "@/utils/gear-comparison/availableGear";

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
    // Stage 1 always resolves from the global festival setup (consistent with
    // compareArtistRequirements); other stages use their stage-specific setup.
    const availableGear: AvailableGear = stage === 1 && globalSetup
      ? mapGlobalSetupToAvailableGear(globalSetup)
      : stageSetup
        ? mapStageSetupToAvailableGear(stageSetup)
        : EMPTY_AVAILABLE_GEAR;

    // FOH Console shortfalls
    Object.entries(requirements.fohConsoles).forEach(([model, required]) => {
      const available = availableGear.foh_consoles.find(c => c.model.toLowerCase() === model.toLowerCase())?.quantity || 0;
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
      const available = availableGear.mon_consoles.find(c => c.model.toLowerCase() === model.toLowerCase())?.quantity || 0;
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
      const available = availableGear.wireless_systems.find(w => w.model.toLowerCase() === model.toLowerCase());
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
      const available = availableGear.iem_systems.find(i => i.model.toLowerCase() === model.toLowerCase());
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
      const available = availableGear.wired_mics.find(m => m.model.toLowerCase() === model.toLowerCase())?.quantity || 0;
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
