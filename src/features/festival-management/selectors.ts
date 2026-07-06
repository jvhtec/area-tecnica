import { eachDayOfInterval, isValid } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import type {
  ArtistRiderFile,
  FestivalFlexStatus,
  FestivalJob,
  FestivalStageOption,
  FestivalWhatsappDepartment,
  GroupedRiderFiles,
  RiderFreshnessArtist,
  RiderLibraryEntry,
  RiderLibraryFile,
  RiderLibrarySourceArtist,
  RiderLibrarySourceJob,
  RiderStatus,
} from "@/features/festival-management/types";
import type { Department } from "@/types/department";

type StageRow = {
  name?: string | null;
  number?: number | null;
};

export type JobDateTypeRow = {
  date?: string | null;
};

const FESTIVAL_TIMEZONE = "Europe/Madrid";

export const FESTIVAL_DEPARTMENT_OPTIONS: Department[] = [
  "sound",
  "lights",
  "video",
  "production",
  "logistics",
  "administrative",
  "personnel",
  "comercial",
];

export const humanizeFestivalDepartment = (dep: Department) => dep.charAt(0).toUpperCase() + dep.slice(1);

export const buildFallbackStageOptions = (maxStages: number): FestivalStageOption[] =>
  Array.from({ length: Math.max(maxStages, 1) }, (_, idx) => ({
    number: idx + 1,
    name: `Stage ${idx + 1}`,
  }));

export const buildFestivalStageOptions = (
  stageRows: StageRow[] | null | undefined,
  fallbackMaxStages: number,
) => {
  const configuredHighestStage = Math.max(
    0,
    ...(stageRows || [])
      .map((row) => Number(row.number))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  const maxStages = Math.max(fallbackMaxStages, configuredHighestStage, 1);
  const stageNameMap = new Map<number, string>(
    (stageRows || [])
      .filter((row) => typeof row.number === "number")
      .map((row) => [row.number as number, row.name || `Stage ${row.number}`]),
  );

  return {
    maxStages,
    options: Array.from({ length: maxStages }, (_, idx) => {
      const stageNumber = idx + 1;
      return {
        number: stageNumber,
        name: stageNameMap.get(stageNumber) || `Stage ${stageNumber}`,
      };
    }),
  };
};

const parseFestivalDateType = (value: string) => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? fromZonedTime(`${value}T00:00:00`, FESTIVAL_TIMEZONE)
    : new Date(value);

  return isValid(parsed) ? parsed : null;
};

export const buildJobDates = (job: Pick<FestivalJob, "start_time" | "end_time">, dateTypes: JobDateTypeRow[] = []) => {
  const startDate = new Date(job.start_time);
  const endDate = new Date(job.end_time);

  if (isValid(startDate) && isValid(endDate)) {
    const zonedStart = toZonedTime(startDate, FESTIVAL_TIMEZONE);
    const zonedEnd = toZonedTime(endDate, FESTIVAL_TIMEZONE);

    if (zonedEnd < zonedStart) {
      return [fromZonedTime(zonedStart, FESTIVAL_TIMEZONE)];
    }

    return eachDayOfInterval({ start: zonedStart, end: zonedEnd }).map((date) =>
      fromZonedTime(date, FESTIVAL_TIMEZONE),
    );
  }

  const fallbackDates = Array.from(
    new Set(
      dateTypes
        .map((dateType) => dateType.date)
        .filter((value): value is string => Boolean(value)),
    ),
  )
    .map(parseFestivalDateType)
    .filter((date): date is Date => Boolean(date));

  return fallbackDates.length > 0 ? fallbackDates : [new Date()];
};

export const groupFestivalRiderFiles = (artistRiderFiles: ArtistRiderFile[]): GroupedRiderFiles => {
  const map = new Map<string, { artistId: string; artistName: string; files: ArtistRiderFile[] }>();

  artistRiderFiles.forEach((file) => {
    const artistId = file.artist_id || file.festival_artists?.id || "unknown";
    const artistName = file.festival_artists?.name || "Unknown Artist";

    if (!map.has(artistId)) {
      map.set(artistId, { artistId, artistName, files: [] });
    }

    map.get(artistId)!.files.push(file);
  });

  return Array.from(map.values()).sort((a, b) => a.artistName.localeCompare(b.artistName));
};

export const isArtistRiderOutdated = (artist: RiderFreshnessArtist) =>
  !artist.rider_outdated_dismissed &&
  (Boolean(artist.rider_outdated) || Boolean(artist.rider_copied_from_date));

export const getArtistRiderStatus = (artist: RiderFreshnessArtist): RiderStatus => {
  if (artist.rider_missing) {
    return "missing";
  }

  if (isArtistRiderOutdated(artist)) {
    return "outdated";
  }

  return "complete";
};

const normalizeRecordMap = <T extends { id: string }>(items: Map<string, T> | Record<string, T>) =>
  items instanceof Map ? items : new Map(Object.entries(items));

const toUploadedAtSortValue = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const buildRiderLibraryEntries = ({
  artistsById,
  files,
  jobsById,
  targetFilePaths = [],
}: {
  artistsById: Map<string, RiderLibrarySourceArtist> | Record<string, RiderLibrarySourceArtist>;
  files: RiderLibraryFile[];
  jobsById: Map<string, RiderLibrarySourceJob> | Record<string, RiderLibrarySourceJob>;
  targetFilePaths?: Iterable<string>;
}): RiderLibraryEntry[] => {
  const artistMap = normalizeRecordMap(artistsById);
  const jobMap = normalizeRecordMap(jobsById);
  const targetPathSet = new Set(targetFilePaths);
  const entries = new Map<string, RiderLibraryEntry>();

  files.forEach((file) => {
    const artist = artistMap.get(file.artist_id);
    if (!artist) return;

    const job = artist.job_id ? jobMap.get(artist.job_id) : undefined;
    const duplicateFilePaths = targetPathSet.has(file.file_path) ? [file.file_path] : [];
    const existingEntry = entries.get(artist.id);

    if (!existingEntry) {
      entries.set(artist.id, {
        alreadyImported: duplicateFilePaths.length > 0,
        artistId: artist.id,
        artistName: artist.name || "Unknown Artist",
        duplicateFilePaths,
        files: [file],
        latestUploadedAt: file.uploaded_at ?? null,
        sourceDate: artist.date ?? null,
        sourceJobId: artist.job_id ?? null,
        sourceJobTitle: job?.title || "Trabajo sin título",
        sourceJobType: job?.job_type ?? null,
        sourceStage: artist.stage ?? null,
      });
      return;
    }

    existingEntry.files.push(file);
    existingEntry.duplicateFilePaths.push(...duplicateFilePaths);
    existingEntry.alreadyImported = existingEntry.alreadyImported || duplicateFilePaths.length > 0;

    const latestCurrent = toUploadedAtSortValue(existingEntry.latestUploadedAt);
    const latestCandidate = toUploadedAtSortValue(file.uploaded_at);
    if (latestCandidate > latestCurrent) {
      existingEntry.latestUploadedAt = file.uploaded_at ?? null;
    }
  });

  return Array.from(entries.values())
    .map((entry) => ({
      ...entry,
      duplicateFilePaths: Array.from(new Set(entry.duplicateFilePaths)),
      files: [...entry.files].sort((a, b) => {
        const byUpload = toUploadedAtSortValue(b.uploaded_at) - toUploadedAtSortValue(a.uploaded_at);
        return byUpload || a.file_name.localeCompare(b.file_name);
      }),
    }))
    .sort((a, b) => {
      const byUpload = toUploadedAtSortValue(b.latestUploadedAt) - toUploadedAtSortValue(a.latestUploadedAt);
      return byUpload || a.artistName.localeCompare(b.artistName);
    });
};

export const formatFestivalDateLabel = (value?: string | null) => {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  return isValid(parsed) ? formatInTimeZone(parsed, FESTIVAL_TIMEZONE, "MMM d, yyyy") : "Unknown date";
};

export const getFestivalFlexStatus = ({
  flexError,
  folderExists,
  isFlexLoading,
}: {
  flexError: string | null;
  folderExists: boolean | null;
  isFlexLoading: boolean;
}): FestivalFlexStatus => {
  if (isFlexLoading) {
    return { label: "Verificando estado…", variant: "outline" };
  }
  if (flexError) {
    return { label: "Error de Flex", variant: "destructive" };
  }
  if (folderExists) {
    return { label: "Carpetas listas", variant: "secondary" };
  }
  return { label: "Carpetas no creadas", variant: "outline" };
};

export const requiresFestivalWhatsappStage = (maxStages: number, department: FestivalWhatsappDepartment) =>
  maxStages > 1 && department !== "lights";

export const normalizeFestivalWhatsappStage = ({
  currentStage,
  department,
  maxStages,
}: {
  currentStage: number;
  department: FestivalWhatsappDepartment;
  maxStages: number;
}) => {
  const total = Math.max(maxStages, 1);

  if (department === "lights") {
    return 0;
  }

  if (total > 1) {
    return currentStage >= 1 && currentStage <= total ? currentStage : 1;
  }

  return 0;
};

export const buildFestivalWhatsappStageOptions = (
  festivalStageOptions: FestivalStageOption[],
  maxStages: number,
) =>
  festivalStageOptions.length > 0
    ? festivalStageOptions
    : Array.from({ length: Math.max(maxStages, 1) }, (_, idx) => ({
        number: idx + 1,
        name: `Stage ${idx + 1}`,
      }));
