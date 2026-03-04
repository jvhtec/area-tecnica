import type { ArtistTablePdfData } from '@/utils/artistTablePdfExport';
import type { ArtistRfIemData, RfIemSystemData } from '@/utils/rfIemTablePdfExport';
import type { ArtistInfrastructureData } from '@/utils/infrastructureTablePdfExport';
import type { ShiftAssignment, ShiftWithAssignments } from '@/types/festival-scheduling';

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeProvider = (value: unknown, fallback: 'festival' | 'band' | 'mixed' = 'festival'): 'festival' | 'band' | 'mixed' => {
  if (value === 'festival' || value === 'band' || value === 'mixed') return value;
  return fallback;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const normalizeRfIemSystems = (
  value: unknown,
  fallbackProvider: 'festival' | 'band' | 'mixed' = 'festival',
): RfIemSystemData[] => {
  return asArray(value)
    .filter(isRecord)
    .map((system) => ({
      model: toStringValue(system.model),
      quantity: toNumber(system.quantity),
      quantity_ch: toNumber(system.quantity_ch),
      quantity_hh: toNumber(system.quantity_hh),
      quantity_bp: toNumber(system.quantity_bp),
      band: typeof system.band === 'string' || isRecord(system.band)
        ? (system.band as RfIemSystemData['band'])
        : undefined,
      provided_by: normalizeProvider(system.provided_by, fallbackProvider),
    }))
    .filter((system) => system.model.length > 0 || (system.quantity_ch || system.quantity_hh || system.quantity_bp || system.quantity));
};

const parseShowMinutes = (value: string | null | undefined): number => {
  if (!value || typeof value !== 'string') {
    return Number.MAX_SAFE_INTEGER;
  }

  const match = value.trim().match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const second = Number(match[3] || '0');

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return hour * 60 + minute + second / 60;
};

const toSortableShowMinutes = (value: string | null | undefined): number => {
  const parsed = parseShowMinutes(value);
  if (!Number.isFinite(parsed)) {
    return Number.MAX_SAFE_INTEGER;
  }

  let total = parsed;
  const hour = Math.floor(parsed / 60);
  // Festival-style default: early-morning shows belong to end-of-day timeline.
  if (hour >= 0 && hour < 7) {
    total += 24 * 60;
  }

  return total;
};

export const sortArtistsChronologically = <T extends {
  date?: string | null;
  stage?: number | string | null;
  show_start?: string | null;
  name?: string | null;
  isaftermidnight?: boolean | null;
}>(artists: T[]): T[] => {
  return [...artists].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';

    if (dateA !== dateB) {
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }

    let aTime = toSortableShowMinutes(a.show_start || '');
    let bTime = toSortableShowMinutes(b.show_start || '');

    // Prefer explicit flag if present from backend/UI preprocessing.
    if (typeof a.isaftermidnight === 'boolean') {
      const baseA = parseShowMinutes(a.show_start || '');
      if (Number.isFinite(baseA)) {
        const isEarlyA = baseA < (7 * 60);
        aTime = isEarlyA
          ? (a.isaftermidnight ? baseA + (24 * 60) : baseA)
          : baseA;
      } else {
        aTime = Number.MAX_SAFE_INTEGER;
      }
    }
    if (typeof b.isaftermidnight === 'boolean') {
      const baseB = parseShowMinutes(b.show_start || '');
      if (Number.isFinite(baseB)) {
        const isEarlyB = baseB < (7 * 60);
        bTime = isEarlyB
          ? (b.isaftermidnight ? baseB + (24 * 60) : baseB)
          : baseB;
      } else {
        bTime = Number.MAX_SAFE_INTEGER;
      }
    }

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    const stageA = toNumber(a.stage, 0);
    const stageB = toNumber(b.stage, 0);
    if (stageA !== stageB) {
      return stageA - stageB;
    }

    return (a.name || '').localeCompare(b.name || '');
  });
};

export const buildArtistTableArtists = (artists: Record<string, unknown>[] = []): ArtistTablePdfData['artists'] => {
  return artists.map((artist) => {
    const wirelessProvidedBy = normalizeProvider(artist.wireless_provided_by, 'festival');
    const iemProvidedBy = normalizeProvider(artist.iem_provided_by, 'festival');

    return {
      name: toStringValue(artist.name, 'Unnamed Artist'),
      stage: toNumber(artist.stage, 1),
      showTime: {
        start: toStringValue(artist.show_start),
        end: toStringValue(artist.show_end),
      },
      soundcheck: artist.soundcheck_start
        ? {
            start: toStringValue(artist.soundcheck_start),
            end: toStringValue(artist.soundcheck_end),
          }
        : undefined,
      technical: {
        fohTech: Boolean(artist.foh_tech),
        monTech: Boolean(artist.mon_tech),
        fohConsole: {
          model: toStringValue(artist.foh_console),
          providedBy: normalizeProvider(artist.foh_console_provided_by, 'festival'),
        },
        monConsole: {
          model: toStringValue(artist.mon_console),
          providedBy: normalizeProvider(artist.mon_console_provided_by, 'festival'),
        },
        monitorsFromFoh: Boolean(artist.monitors_from_foh),
        fohWavesOutboard: toStringValue(artist.foh_waves_outboard),
        monWavesOutboard: toStringValue(artist.mon_waves_outboard),
        wireless: {
          systems: normalizeRfIemSystems(artist.wireless_systems, wirelessProvidedBy),
          providedBy: wirelessProvidedBy,
        },
        iem: {
          systems: normalizeRfIemSystems(artist.iem_systems, iemProvidedBy),
          providedBy: iemProvidedBy,
        },
        monitors: {
          enabled: Boolean(artist.monitors_enabled),
          quantity: toNumber(artist.monitors_quantity),
        },
      },
      extras: {
        sideFill: Boolean(artist.extras_sf),
        drumFill: Boolean(artist.extras_df),
        djBooth: Boolean(artist.extras_djbooth),
      },
      notes: toStringValue(artist.notes),
      micKit: normalizeProvider(artist.mic_kit, 'band'),
      wiredMics: asArray(artist.wired_mics)
        .filter(isRecord)
        .map((mic) => ({
          model: toStringValue(mic.model),
          quantity: toNumber(mic.quantity),
          exclusive_use: Boolean(mic.exclusive_use),
          notes: toStringValue(mic.notes),
        })),
      infrastructure: {
        infra_cat6: Boolean(artist.infra_cat6),
        infra_cat6_quantity: toNumber(artist.infra_cat6_quantity),
        infra_hma: Boolean(artist.infra_hma),
        infra_hma_quantity: toNumber(artist.infra_hma_quantity),
        infra_coax: Boolean(artist.infra_coax),
        infra_coax_quantity: toNumber(artist.infra_coax_quantity),
        infra_opticalcon_duo: Boolean(artist.infra_opticalcon_duo),
        infra_opticalcon_duo_quantity: toNumber(artist.infra_opticalcon_duo_quantity),
        infra_analog: toNumber(artist.infra_analog),
        other_infrastructure: toStringValue(artist.other_infrastructure),
        infrastructure_provided_by: normalizeProvider(artist.infrastructure_provided_by, 'festival'),
      },
      riderMissing: Boolean(artist.rider_missing),
    };
  });
};

export const buildRfIemArtists = (artists: Record<string, unknown>[] = []): ArtistRfIemData[] => {
  return artists.map((artist) => {
    const wirelessProvidedBy = normalizeProvider(artist.wireless_provided_by, 'festival');
    const iemProvidedBy = normalizeProvider(artist.iem_provided_by, 'festival');
    const showStart = toStringValue(artist.show_start || artist.showStart);
    const baseShowMinutes = parseShowMinutes(showStart);
    const computedAfterMidnight = Number.isFinite(baseShowMinutes) && baseShowMinutes < (7 * 60);
    const explicitAfterMidnight = typeof artist.isaftermidnight === 'boolean'
      ? artist.isaftermidnight
      : typeof artist.isAfterMidnight === 'boolean'
        ? artist.isAfterMidnight
        : undefined;

    return {
      name: toStringValue(artist.name, 'Unnamed Artist'),
      stage: toNumber(artist.stage, 1),
      wirelessSystems: normalizeRfIemSystems(artist.wirelessSystems ?? artist.wireless_systems, wirelessProvidedBy),
      iemSystems: normalizeRfIemSystems(artist.iemSystems ?? artist.iem_systems, iemProvidedBy),
      date: toStringValue(artist.date),
      isAfterMidnight: explicitAfterMidnight === true || computedAfterMidnight,
      showStart,
      showEnd: toStringValue(artist.show_end || artist.showEnd),
      soundcheckStart: toStringValue(artist.soundcheck_start || artist.soundcheckStart),
      soundcheckEnd: toStringValue(artist.soundcheck_end || artist.soundcheckEnd),
    };
  });
};

export const hasRfIemSystems = (artist: ArtistRfIemData): boolean => {
  return artist.wirelessSystems.length > 0 || artist.iemSystems.length > 0;
};

export const buildInfrastructureArtists = (artists: Record<string, unknown>[] = []): ArtistInfrastructureData[] => {
  return artists.map((artist) => ({
    name: toStringValue(artist.name, 'Unnamed Artist'),
    stage: toNumber(artist.stage, 1),
    providedBy: normalizeProvider(artist.providedBy ?? artist.infrastructure_provided_by, 'festival'),
    cat6: {
      enabled: Boolean(artist.cat6_enabled ?? artist.infra_cat6),
      quantity: toNumber(artist.cat6_quantity ?? artist.infra_cat6_quantity),
    },
    hma: {
      enabled: Boolean(artist.hma_enabled ?? artist.infra_hma),
      quantity: toNumber(artist.hma_quantity ?? artist.infra_hma_quantity),
    },
    coax: {
      enabled: Boolean(artist.coax_enabled ?? artist.infra_coax),
      quantity: toNumber(artist.coax_quantity ?? artist.infra_coax_quantity),
    },
    opticalconDuo: {
      enabled: Boolean(artist.opticalcon_duo_enabled ?? artist.infra_opticalcon_duo),
      quantity: toNumber(artist.opticalcon_duo_quantity ?? artist.infra_opticalcon_duo_quantity),
    },
    analog: toNumber(artist.analog ?? artist.infra_analog),
    other: toStringValue(artist.other ?? artist.other_infrastructure),
  }));
};

export const hasInfrastructureNeeds = (artist: ArtistInfrastructureData): boolean => {
  return artist.cat6.enabled ||
    artist.hma.enabled ||
    artist.coax.enabled ||
    artist.opticalconDuo.enabled ||
    artist.analog > 0 ||
    artist.other.trim().length > 0;
};

interface ShiftLike {
  id: string;
  job_id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  department?: string | null;
  stage?: number | string | null;
}

interface AssignmentLike {
  id?: string;
  shift_id: string;
  technician_id?: string | null;
  external_technician_name?: string | null;
  role?: string | null;
}

interface ProfileLike {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  department?: string | null;
  role?: string | null;
}

export const attachShiftAssignmentsAndProfiles = (
  shifts: ShiftLike[] = [],
  assignments: AssignmentLike[] = [],
  profilesById: Map<string, ProfileLike> = new Map(),
): ShiftWithAssignments[] => {
  const assignmentsByShiftId = assignments.reduce((acc, assignment) => {
    const shiftId = toStringValue(assignment.shift_id);
    if (!shiftId) return acc;
    if (!acc.has(shiftId)) acc.set(shiftId, []);
    acc.get(shiftId)?.push(assignment);
    return acc;
  }, new Map<string, AssignmentLike[]>());

  return shifts.map((shift) => {
    const shiftAssignments = assignmentsByShiftId.get(shift.id) || [];
    const mappedAssignments: ShiftAssignment[] = shiftAssignments.map((assignment, index) => {
      const technicianId = assignment.technician_id ? String(assignment.technician_id) : undefined;
      const profile = technicianId ? profilesById.get(technicianId) : undefined;

      return {
        id: assignment.id ? String(assignment.id) : `${shift.id}-${technicianId || 'ext'}-${index}`,
        shift_id: shift.id,
        technician_id: technicianId,
        external_technician_name: assignment.external_technician_name ? String(assignment.external_technician_name) : undefined,
        role: toStringValue(assignment.role, 'N/A'),
        profiles: profile
          ? {
              id: profile.id,
              first_name: toStringValue(profile.first_name),
              nickname: null,
              last_name: toStringValue(profile.last_name),
              email: toStringValue(profile.email),
              department: toStringValue(profile.department),
              role: toStringValue(profile.role),
            }
          : null,
      };
    });

    return {
      id: String(shift.id),
      job_id: String(shift.job_id),
      name: toStringValue(shift.name, 'Turno'),
      date: toStringValue(shift.date),
      start_time: toStringValue(shift.start_time),
      end_time: toStringValue(shift.end_time),
      department: shift.department ? String(shift.department) : undefined,
      stage: shift.stage === null || shift.stage === undefined ? undefined : toNumber(shift.stage),
      assignments: mappedAssignments,
    };
  });
};
