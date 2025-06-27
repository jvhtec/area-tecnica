
interface ConflictResult {
  hasConflict: boolean;
  conflictType: 'unavailable' | 'insufficient' | 'model_mismatch' | 'provider_mismatch';
  availableQuantity?: number;
  requestedQuantity?: number;
  availableModels?: string[];
  requestedModel?: string;
}

interface ArtistConflicts {
  fohConsole: ConflictResult;
  monConsole: ConflictResult;
  wireless: ConflictResult[];
  iem: ConflictResult[];
  monitors: ConflictResult;
  infrastructure: {
    cat6: ConflictResult;
    hma: ConflictResult;
    coax: ConflictResult;
    opticalconDuo: ConflictResult;
    analog: ConflictResult;
  };
  extras: {
    sideFill: ConflictResult;
    drumFill: ConflictResult;
    djBooth: ConflictResult;
  };
}

export interface StageSetupData {
  foh_consoles: Array<{ model: string; quantity: number }>;
  mon_consoles: Array<{ model: string; quantity: number }>;
  wireless_systems: Array<{ model: string; quantity_hh?: number; quantity_bp?: number }>;
  iem_systems: Array<{ model: string; quantity_hh?: number; quantity_bp?: number }>;
  monitors_quantity: number;
  infra_cat6_quantity: number;
  infra_hma_quantity: number;
  infra_coax_quantity: number;
  infra_opticalcon_duo_quantity: number;
  infra_analog: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
}

const createNoConflict = (): ConflictResult => ({
  hasConflict: false,
  conflictType: 'unavailable'
});

const detectConsoleConflict = (
  requestedModel: string,
  providedBy: string,
  availableConsoles: Array<{ model: string; quantity: number }>
): ConflictResult => {
  if (providedBy === 'band') {
    return createNoConflict();
  }

  const available = availableConsoles.find(c => c.model === requestedModel);
  if (!available) {
    return {
      hasConflict: true,
      conflictType: 'model_mismatch',
      availableModels: availableConsoles.map(c => c.model),
      requestedModel
    };
  }

  if (available.quantity === 0) {
    return {
      hasConflict: true,
      conflictType: 'insufficient',
      availableQuantity: 0,
      requestedQuantity: 1
    };
  }

  return createNoConflict();
};

const detectWirelessConflicts = (
  requestedSystems: Array<{ model: string; quantity_hh?: number; quantity_bp?: number }>,
  providedBy: string,
  availableSystems: Array<{ model: string; quantity_hh?: number; quantity_bp?: number }>
): ConflictResult[] => {
  if (providedBy === 'band') {
    return requestedSystems.map(() => createNoConflict());
  }

  return requestedSystems.map(requested => {
    const available = availableSystems.find(a => a.model === requested.model);
    
    if (!available) {
      return {
        hasConflict: true,
        conflictType: 'model_mismatch',
        availableModels: availableSystems.map(s => s.model),
        requestedModel: requested.model
      };
    }

    const requestedHH = requested.quantity_hh || 0;
    const requestedBP = requested.quantity_bp || 0;
    const availableHH = available.quantity_hh || 0;
    const availableBP = available.quantity_bp || 0;

    if (requestedHH > availableHH || requestedBP > availableBP) {
      return {
        hasConflict: true,
        conflictType: 'insufficient',
        availableQuantity: Math.min(availableHH, availableBP),
        requestedQuantity: Math.max(requestedHH, requestedBP)
      };
    }

    return createNoConflict();
  });
};

const detectQuantityConflict = (
  requested: number,
  available: number,
  providedBy?: string
): ConflictResult => {
  if (providedBy === 'band') {
    return createNoConflict();
  }

  if (requested > available) {
    return {
      hasConflict: true,
      conflictType: 'insufficient',
      availableQuantity: available,
      requestedQuantity: requested
    };
  }

  return createNoConflict();
};

const detectBooleanConflict = (
  requested: boolean,
  available: boolean
): ConflictResult => {
  if (requested && !available) {
    return {
      hasConflict: true,
      conflictType: 'unavailable'
    };
  }

  return createNoConflict();
};

export const detectArtistConflicts = (
  artist: any,
  stageSetup: StageSetupData | null
): ArtistConflicts => {
  if (!stageSetup) {
    // If no stage setup data, assume everything conflicts
    return {
      fohConsole: { hasConflict: true, conflictType: 'unavailable' },
      monConsole: { hasConflict: true, conflictType: 'unavailable' },
      wireless: [],
      iem: [],
      monitors: { hasConflict: true, conflictType: 'unavailable' },
      infrastructure: {
        cat6: { hasConflict: true, conflictType: 'unavailable' },
        hma: { hasConflict: true, conflictType: 'unavailable' },
        coax: { hasConflict: true, conflictType: 'unavailable' },
        opticalconDuo: { hasConflict: true, conflictType: 'unavailable' },
        analog: { hasConflict: true, conflictType: 'unavailable' }
      },
      extras: {
        sideFill: { hasConflict: true, conflictType: 'unavailable' },
        drumFill: { hasConflict: true, conflictType: 'unavailable' },
        djBooth: { hasConflict: true, conflictType: 'unavailable' }
      }
    };
  }

  return {
    fohConsole: detectConsoleConflict(
      artist.technical.fohConsole.model,
      artist.technical.fohConsole.providedBy,
      stageSetup.foh_consoles
    ),
    monConsole: detectConsoleConflict(
      artist.technical.monConsole.model,
      artist.technical.monConsole.providedBy,
      stageSetup.mon_consoles
    ),
    wireless: detectWirelessConflicts(
      artist.technical.wireless.systems,
      artist.technical.wireless.providedBy,
      stageSetup.wireless_systems
    ),
    iem: detectWirelessConflicts(
      artist.technical.iem.systems,
      artist.technical.iem.providedBy,
      stageSetup.iem_systems
    ),
    monitors: detectQuantityConflict(
      artist.technical.monitors.quantity,
      stageSetup.monitors_quantity
    ),
    infrastructure: {
      cat6: detectQuantityConflict(
        artist.infrastructure.infra_cat6_quantity || 0,
        stageSetup.infra_cat6_quantity,
        artist.infrastructure.infrastructure_provided_by
      ),
      hma: detectQuantityConflict(
        artist.infrastructure.infra_hma_quantity || 0,
        stageSetup.infra_hma_quantity,
        artist.infrastructure.infrastructure_provided_by
      ),
      coax: detectQuantityConflict(
        artist.infrastructure.infra_coax_quantity || 0,
        stageSetup.infra_coax_quantity,
        artist.infrastructure.infrastructure_provided_by
      ),
      opticalconDuo: detectQuantityConflict(
        artist.infrastructure.infra_opticalcon_duo_quantity || 0,
        stageSetup.infra_opticalcon_duo_quantity,
        artist.infrastructure.infrastructure_provided_by
      ),
      analog: detectQuantityConflict(
        artist.infrastructure.infra_analog || 0,
        stageSetup.infra_analog,
        artist.infrastructure.infrastructure_provided_by
      )
    },
    extras: {
      sideFill: detectBooleanConflict(artist.extras.sideFill, stageSetup.extras_sf),
      drumFill: detectBooleanConflict(artist.extras.drumFill, stageSetup.extras_df),
      djBooth: detectBooleanConflict(artist.extras.djBooth, stageSetup.extras_djbooth)
    }
  };
};

export { ArtistConflicts, ConflictResult };
