import type { PushPayload } from "./types.ts";

export const FESTIVAL_FEED_EVENT_TYPE = "festival.feed.tick";
export const FESTIVAL_FEED_TIMEZONE = "Europe/Madrid";

export type FestivalFeedRole = string | null;

export type FestivalFeedSubscription = {
  user_id: string;
  job_id: string;
  enabled: boolean;
  stages: number[];
  role: FestivalFeedRole;
};

export type FestivalFeedArtist = {
  id: string;
  job_id: string | null;
  name: string;
  date: string | null;
  stage: number | null;
  show_start: string | null;
  soundcheck: boolean | null;
  soundcheck_start: string | null;
  line_check: boolean | null;
  line_check_start: string | null;
  timezone: string | null;
  isaftermidnight: boolean | null;
};

export type FestivalFeedShift = {
  id: string;
  job_id: string | null;
  date: string;
  stage: number | null;
  name: string;
  start_time: string;
  end_time: string;
};

export type FestivalFeedShiftAssignment = {
  shift_id: string | null;
  technician_id: string | null;
};

export type FestivalFeedEventKind =
  | "soundcheck_15"
  | "soundcheck_now"
  | "linecheck_15"
  | "linecheck_now"
  | "show_15"
  | "show_now"
  | "shift_start_15"
  | "shift_end_15"
  | "shift_end_now";

export type FestivalFeedEvent = {
  eventKey: string;
  eventKind: FestivalFeedEventKind;
  jobId: string;
  dueAt: Date;
  date: string;
  urlDate: string;
  stage: number | null;
  title: string;
  body: string;
  artistId?: string;
  artistName?: string;
  shiftId?: string;
  shiftName?: string;
};

type ArtistMomentConfig = {
  kind: FestivalFeedEventKind;
  source: "soundcheck" | "linecheck" | "show";
  leadMinutes: number;
};

const ARTIST_MOMENTS: ArtistMomentConfig[] = [
  { kind: "soundcheck_15", source: "soundcheck", leadMinutes: 15 },
  { kind: "soundcheck_now", source: "soundcheck", leadMinutes: 0 },
  { kind: "linecheck_15", source: "linecheck", leadMinutes: 15 },
  { kind: "linecheck_now", source: "linecheck", leadMinutes: 0 },
  { kind: "show_15", source: "show", leadMinutes: 15 },
  { kind: "show_now", source: "show", leadMinutes: 0 },
];

const pad2 = (value: number) => String(value).padStart(2, "0");

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const parseTime = (time: string | null | undefined) => {
  if (!time) return null;
  const [hours, minutes = "0", seconds = "0"] = time.split(":");
  const hour = Number(hours);
  const minute = Number(minutes);
  const second = Number(seconds);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
    return null;
  }
  return { hour, minute, second };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const timeZoneName = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT" || timeZoneName === "UTC") {
    return 0;
  }

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * ((hours * 60 + minutes) * 60 * 1000);
};

export const zonedDateTimeToUtc = (
  dateKey: string,
  time: string,
  timeZone = FESTIVAL_FEED_TIMEZONE,
): Date | null => {
  const parsedDate = parseDateKey(dateKey);
  const parsedTime = parseTime(time);
  if (!parsedDate || !parsedTime) return null;

  const utcGuess = new Date(Date.UTC(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    parsedTime.hour,
    parsedTime.minute,
    parsedTime.second,
  ));
  const firstOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstCandidate = new Date(utcGuess.getTime() - firstOffset);
  const correctedOffset = getTimeZoneOffsetMs(firstCandidate, timeZone);

  return new Date(utcGuess.getTime() - correctedOffset);
};

export const formatDateKeyInTimeZone = (
  date: Date,
  timeZone = FESTIVAL_FEED_TIMEZONE,
): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

export const addDaysToDateKey = (dateKey: string, days: number): string => {
  const parsedDate = parseDateKey(dateKey);
  if (!parsedDate) return dateKey;
  const date = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

const subtractMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() - minutes * 60 * 1000);

export const isDueInWindow = (
  dueAt: Date,
  now: Date,
  lookbackMs = 65_000,
  lookaheadMs = 5_000,
): boolean => {
  const deltaMs = dueAt.getTime() - now.getTime();
  return deltaMs >= -lookbackMs && deltaMs <= lookaheadMs;
};

const normalizeStageLabel = (jobId: string, stage: number | null, stageNames?: Map<string, string>) => {
  if (stage === null) return "";
  return stageNames?.get(`${jobId}:${stage}`) || stageNames?.get(String(stage)) || `Escenario ${stage}`;
};

const getArtistMomentTime = (artist: FestivalFeedArtist, source: ArtistMomentConfig["source"]): string | null => {
  // soundcheck_start/line_check_start can hold stale values after the artist is
  // toggled off in the form, so the enabled flag is the source of truth.
  if (source === "soundcheck") return artist.soundcheck ? artist.soundcheck_start : null;
  if (source === "linecheck") return artist.line_check ? artist.line_check_start : null;
  return artist.show_start;
};

const getArtistMomentDateKey = (
  artist: FestivalFeedArtist,
  source: ArtistMomentConfig["source"],
): string | null => {
  if (!artist.date) return null;
  if ((source === "linecheck" || source === "show") && artist.isaftermidnight) {
    return addDaysToDateKey(artist.date, 1);
  }
  return artist.date;
};

const buildArtistMessage = (
  artistName: string,
  stageLabel: string,
  eventKind: FestivalFeedEventKind,
  eventTime: string,
) => {
  if (eventKind === "soundcheck_15") {
    return {
      title: "Prueba de sonido en 15 min",
      body: `En 15 min empieza la prueba de sonido de ${artistName} en ${stageLabel}.`,
    };
  }

  if (eventKind === "soundcheck_now") {
    return {
      title: "Prueba de sonido ahora",
      body: `Empieza ahora la prueba de sonido de ${artistName} en ${stageLabel}.`,
    };
  }

  if (eventKind === "linecheck_15") {
    return {
      title: "Line check en 15 min",
      body: `En 15 min empieza el line check de ${artistName} en ${stageLabel}.`,
    };
  }

  if (eventKind === "linecheck_now") {
    return {
      title: "Line check ahora",
      body: `Empieza ahora el line check de ${artistName} en ${stageLabel}.`,
    };
  }

  if (eventKind === "show_15") {
    return {
      title: "Show en 15 min",
      body: `Próximo artista en ${stageLabel}: ${artistName} a las ${eventTime.slice(0, 5)}.`,
    };
  }

  return {
    title: "Empieza el show",
    body: `${artistName} empieza ahora en ${stageLabel}.`,
  };
};

export const buildFestivalFeedArtistEvents = (
  artists: FestivalFeedArtist[],
  stageNames?: Map<string, string>,
): FestivalFeedEvent[] => {
  const events: FestivalFeedEvent[] = [];

  for (const artist of artists) {
    if (!artist.id || !artist.job_id || !artist.date || typeof artist.stage !== "number") {
      continue;
    }

    for (const moment of ARTIST_MOMENTS) {
      const time = getArtistMomentTime(artist, moment.source);
      if (!time) continue;

      const localDate = getArtistMomentDateKey(artist, moment.source);
      if (!localDate) continue;

      const dueBase = zonedDateTimeToUtc(localDate, time, artist.timezone || FESTIVAL_FEED_TIMEZONE);
      if (!dueBase) continue;

      const dueAt = subtractMinutes(dueBase, moment.leadMinutes);
      const stageLabel = normalizeStageLabel(artist.job_id, artist.stage, stageNames);
      const message = buildArtistMessage(artist.name, stageLabel, moment.kind, time);

      events.push({
        eventKey: `artist:${artist.id}:${moment.kind}:${dueAt.toISOString()}`,
        eventKind: moment.kind,
        jobId: artist.job_id,
        dueAt,
        date: localDate,
        urlDate: artist.date,
        stage: artist.stage,
        title: message.title,
        body: message.body,
        artistId: artist.id,
        artistName: artist.name,
      });
    }
  }

  return events;
};

const isTimeBeforeOrEqual = (left: string, right: string): boolean => {
  const leftTime = parseTime(left);
  const rightTime = parseTime(right);
  if (!leftTime || !rightTime) return false;
  const leftSeconds = leftTime.hour * 3600 + leftTime.minute * 60 + leftTime.second;
  const rightSeconds = rightTime.hour * 3600 + rightTime.minute * 60 + rightTime.second;
  return leftSeconds <= rightSeconds;
};

const buildShiftMessage = (
  shift: FestivalFeedShift,
  stageLabel: string,
  eventKind: FestivalFeedEventKind,
) => {
  const stageSuffix = stageLabel ? ` en ${stageLabel}` : "";

  if (eventKind === "shift_start_15") {
    return {
      title: "Tu turno empieza en 15 min",
      body: `${shift.name} empieza a las ${shift.start_time.slice(0, 5)}${stageSuffix}.`,
    };
  }

  if (eventKind === "shift_end_15") {
    return {
      title: "Tu turno acaba en 15 min",
      body: `${shift.name} acaba a las ${shift.end_time.slice(0, 5)}${stageSuffix}.`,
    };
  }

  return {
    title: "Turno finalizado",
    body: "Tu turno ha acabado, muchas gracias por el trabajo y no olvides firmar tus horas.",
  };
};

export const buildFestivalFeedShiftEvents = (
  shifts: FestivalFeedShift[],
  stageNames?: Map<string, string>,
): FestivalFeedEvent[] => {
  const events: FestivalFeedEvent[] = [];

  for (const shift of shifts) {
    if (!shift.id || !shift.job_id || !shift.date || !shift.start_time || !shift.end_time) {
      continue;
    }

    const shiftStart = zonedDateTimeToUtc(shift.date, shift.start_time, FESTIVAL_FEED_TIMEZONE);
    const endDate = isTimeBeforeOrEqual(shift.end_time, shift.start_time)
      ? addDaysToDateKey(shift.date, 1)
      : shift.date;
    const shiftEnd = zonedDateTimeToUtc(endDate, shift.end_time, FESTIVAL_FEED_TIMEZONE);
    if (!shiftStart || !shiftEnd) continue;

    const stageLabel = normalizeStageLabel(shift.job_id, shift.stage, stageNames);
    const moments: Array<{ kind: FestivalFeedEventKind; dueAt: Date }> = [
      { kind: "shift_start_15", dueAt: subtractMinutes(shiftStart, 15) },
      { kind: "shift_end_15", dueAt: subtractMinutes(shiftEnd, 15) },
      { kind: "shift_end_now", dueAt: shiftEnd },
    ];

    for (const moment of moments) {
      const message = buildShiftMessage(shift, stageLabel, moment.kind);
      events.push({
        eventKey: `shift:${shift.id}:${moment.kind}:${moment.dueAt.toISOString()}`,
        eventKind: moment.kind,
        jobId: shift.job_id,
        dueAt: moment.dueAt,
        date: moment.kind === "shift_start_15" ? shift.date : endDate,
        urlDate: shift.date,
        stage: shift.stage,
        title: message.title,
        body: message.body,
        shiftId: shift.id,
        shiftName: shift.name,
      });
    }
  }

  return events;
};

export const buildAssignedStagesByUserJob = (
  shifts: FestivalFeedShift[],
  assignments: FestivalFeedShiftAssignment[],
): Map<string, Set<number>> => {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
  const assignedStages = new Map<string, Set<number>>();

  for (const assignment of assignments) {
    if (!assignment.shift_id || !assignment.technician_id) continue;
    const shift = shiftById.get(assignment.shift_id);
    if (!shift?.job_id || !shift.date || typeof shift.stage !== "number") continue;

    const key = `${assignment.technician_id}:${shift.job_id}:${shift.date}`;
    const stages = assignedStages.get(key) ?? new Set<number>();
    stages.add(shift.stage);
    assignedStages.set(key, stages);
  }

  return assignedStages;
};

export const buildAssignedUsersByShift = (
  assignments: FestivalFeedShiftAssignment[],
): Map<string, Set<string>> => {
  const usersByShift = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    if (!assignment.shift_id || !assignment.technician_id) continue;
    const users = usersByShift.get(assignment.shift_id) ?? new Set<string>();
    users.add(assignment.technician_id);
    usersByShift.set(assignment.shift_id, users);
  }

  return usersByShift;
};

const isAdminOrManagement = (role: FestivalFeedRole): boolean =>
  role === "admin" || role === "management";

const isStrictAssignedRole = (role: FestivalFeedRole): boolean =>
  role === "technician" || role === "house_tech";

export const resolveArtistRecipients = (
  event: FestivalFeedEvent,
  subscriptions: FestivalFeedSubscription[],
  assignedStagesByUserJob: Map<string, Set<number>>,
): FestivalFeedSubscription[] => {
  if (typeof event.stage !== "number") return [];

  return subscriptions.filter((subscription) => {
    if (!subscription.enabled || subscription.job_id !== event.jobId) return false;
    if (!subscription.stages.includes(event.stage as number)) return false;

    if (isAdminOrManagement(subscription.role)) {
      return true;
    }

    if (isStrictAssignedRole(subscription.role)) {
      return assignedStagesByUserJob
        .get(`${subscription.user_id}:${event.jobId}:${event.urlDate}`)
        ?.has(event.stage as number) === true;
    }

    return false;
  });
};

export const resolveShiftRecipients = (
  event: FestivalFeedEvent,
  subscriptions: FestivalFeedSubscription[],
  assignedUsersByShift: Map<string, Set<string>>,
): FestivalFeedSubscription[] => {
  if (!event.shiftId) return [];
  const assignedUsers = assignedUsersByShift.get(event.shiftId);
  if (!assignedUsers || assignedUsers.size === 0) return [];

  return subscriptions.filter((subscription) => {
    if (!subscription.enabled || subscription.job_id !== event.jobId) return false;
    if (!assignedUsers.has(subscription.user_id)) return false;
    if (typeof event.stage === "number" && !subscription.stages.includes(event.stage)) return false;
    return true;
  });
};

export const buildFestivalFeedUrl = (
  role: FestivalFeedRole,
  jobId: string,
  date: string,
  stage: number | null,
): string => {
  const params = new URLSearchParams({ date });
  if (typeof stage === "number") {
    params.set("stage", String(stage));
  }

  if (role === "technician") {
    params.set("open", "artists");
    params.set("jobId", jobId);
    const ordered = new URLSearchParams();
    ordered.set("open", "artists");
    ordered.set("jobId", jobId);
    ordered.set("date", date);
    if (typeof stage === "number") ordered.set("stage", String(stage));
    return `/tech-app?${ordered.toString()}`;
  }

  return `/festival-management/${jobId}/artists?${params.toString()}`;
};

export const buildFestivalFeedPayload = (
  event: FestivalFeedEvent,
  subscription: FestivalFeedSubscription,
): PushPayload => ({
  title: event.title,
  body: event.body,
  url: buildFestivalFeedUrl(subscription.role, event.jobId, event.urlDate, event.stage),
  type: FESTIVAL_FEED_EVENT_TYPE,
  meta: {
    eventKey: event.eventKey,
    eventKind: event.eventKind,
    jobId: event.jobId,
    artistId: event.artistId,
    artistName: event.artistName,
    shiftId: event.shiftId,
    shiftName: event.shiftName,
    date: event.urlDate,
    stage: event.stage,
    dueAt: event.dueAt.toISOString(),
  },
});
