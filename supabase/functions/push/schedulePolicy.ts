export type ScheduledMinuteConfig = {
  timezone?: string | null;
  schedule_time: string;
  days_of_week?: number[] | null;
  last_sent_at?: string | null;
};

type ZonedMinute = {
  year: string;
  month: string;
  day: string;
  weekday: string;
  hour: number;
  minute: number;
};

const WEEKDAY_NUMBER: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function zonedMinute(date: Date, timezone: string): ZonedMinute {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function isScheduleDue(
  config: ScheduledMinuteConfig,
  now: Date = new Date(),
): boolean {
  const timezone = config.timezone || "Europe/Madrid";
  const current = zonedMinute(now, timezone);
  const [scheduledHour, scheduledMinute] = config.schedule_time
    .split(":")
    .slice(0, 2)
    .map(Number);

  if (!Number.isInteger(scheduledHour) || !Number.isInteger(scheduledMinute)) {
    return false;
  }
  const allowedDays = config.days_of_week || [1, 2, 3, 4, 5];
  if (!allowedDays.includes(WEEKDAY_NUMBER[current.weekday] || 0)) {
    return false;
  }
  if (current.hour !== scheduledHour || current.minute !== scheduledMinute) {
    return false;
  }
  if (!config.last_sent_at) {
    return true;
  }

  const lastSent = zonedMinute(new Date(config.last_sent_at), timezone);
  return !(
    lastSent.year === current.year
    && lastSent.month === current.month
    && lastSent.day === current.day
    && lastSent.hour === current.hour
    && lastSent.minute === current.minute
  );
}
