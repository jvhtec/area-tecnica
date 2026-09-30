import {
  DEFAULT_FESTIVAL_DAY_START_TIME,
  getFestivalDayOffset,
  getFestivalDayStartMinutes,
} from "@/features/festival-management/dayStart";
import type { FestivalStageOption } from "@/features/festival-management/types";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";

import {
  formatShiftTime,
  normalizeShiftDepartment,
  SHIFT_DEPARTMENT_OPTIONS,
  shiftDepartmentLabel,
  shiftDurationMinutes,
  shiftStageLabel,
} from "./shiftModel";

// The day board lays a festival day out as a timeline that runs from the day's start (07:00 by
// default) to the same time next morning, so an overnight shift reads as one block instead of being
// split at midnight. Free of React so it can be unit tested.

export const MINUTES_PER_DAY = 24 * 60;
/** Where a click on an empty lane is rounded to, and how long the shift it starts is. */
export const BOARD_SNAP_MINUTES = 30;
export const BOARD_DEFAULT_SHIFT_MINUTES = 60;
/** Pixels per hour of the timeline. */
export const BOARD_HOUR_PX = 48;
/** A block is never drawn shorter than this, so its name stays readable and clickable. */
export const BOARD_MIN_BLOCK_PX = 30;
/** The minutes a minimum-height block actually covers: what overlap has to be judged on. */
export const BOARD_MIN_BLOCK_MINUTES = (BOARD_MIN_BLOCK_PX / BOARD_HOUR_PX) * 60;

export type BoardLaneMode = "stage" | "department";

export interface BoardItem {
  shift: ShiftWithAssignments;
  /** Minutes after the day start at which the shift begins (0–1439). */
  start: number;
  /** Minutes after the day start at which it ends; past 1440 when it runs on into the next day. */
  end: number;
  /** The block is cut at the end of the board because the shift continues past the next day start. */
  clipped: boolean;
  /** Side-by-side position among the shifts it overlaps in its lane. */
  column: number;
  columns: number;
}

export interface BoardLane {
  /** Stable key: the stage number, the department code, or "none". */
  key: string;
  label: string;
  /** What a shift created from this lane gets (a stage number or a department code). */
  stage: number | null;
  department: string | null;
  items: BoardItem[];
}

export interface BoardHourMark {
  offset: number;
  label: string;
}

export interface DayBoard {
  lanes: BoardLane[];
  hours: BoardHourMark[];
}

const NO_LANE = "none";

const pad = (value: number) => String(value).padStart(2, "0");

/** "HH:MM" of a position on the board. */
export const boardOffsetToClock = (offset: number, dayStartTime: string): string => {
  const total = (getFestivalDayStartMinutes(dayStartTime) + Math.round(offset)) % MINUTES_PER_DAY;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

/** One mark per hour of the festival day, labelled with the clock time. */
export const boardHourMarks = (dayStartTime: string): BoardHourMark[] =>
  Array.from({ length: 24 }, (_, hour) => ({
    offset: hour * 60,
    label: boardOffsetToClock(hour * 60, dayStartTime),
  }));

/**
 * Sets each item's column among the ones it overlaps: the earliest takes the first free column, and
 * every item in a group of overlapping shifts shares the group's column count, so widths line up.
 */
const packColumns = (items: BoardItem[]): void => {
  // Overlap is judged on what is drawn, not on the times: a 30-minute shift is drawn taller than its
  // slot, so the shift right after it would otherwise be painted over it.
  const drawnEnd = (item: BoardItem) => Math.max(item.end, item.start + BOARD_MIN_BLOCK_MINUTES);
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  let group: BoardItem[] = [];
  let groupEnd = -1;
  let columnEnds: number[] = [];

  const closeGroup = () => {
    for (const member of group) member.columns = columnEnds.length;
    group = [];
    columnEnds = [];
    groupEnd = -1;
  };

  for (const item of sorted) {
    if (group.length > 0 && item.start >= groupEnd) closeGroup();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(drawnEnd(item));
    } else {
      columnEnds[column] = drawnEnd(item);
    }
    item.column = column;
    group.push(item);
    groupEnd = Math.max(groupEnd, drawnEnd(item));
  }
  closeGroup();
};

const toItem = (shift: ShiftWithAssignments, dayStartTime: string): BoardItem => {
  const start = getFestivalDayOffset(shift.start_time, dayStartTime) ?? 0;
  const end = start + shiftDurationMinutes(shift.start_time, shift.end_time);
  return { shift, start, end, clipped: end > MINUTES_PER_DAY, column: 0, columns: 1 };
};

/**
 * The lanes of one festival day. By stage there is a lane for every stage of the festival (empty ones
 * too, so a shift can be started there) plus "Sin stage" and any stage a shift still carries that the
 * festival no longer lists. By department there is a lane per department in use, or all of them
 * while the day is empty.
 */
export const buildDayBoard = ({
  shifts,
  dayStartTime = DEFAULT_FESTIVAL_DAY_START_TIME,
  laneBy,
  stageOptions,
}: {
  shifts: readonly ShiftWithAssignments[];
  dayStartTime?: string;
  laneBy: BoardLaneMode;
  stageOptions: readonly FestivalStageOption[];
}): DayBoard => {
  const lanes = new Map<string, BoardLane>();
  const addLane = (lane: Omit<BoardLane, "items">) => {
    if (!lanes.has(lane.key)) lanes.set(lane.key, { ...lane, items: [] });
  };

  if (laneBy === "stage") {
    for (const option of [...stageOptions].sort((a, b) => a.number - b.number)) {
      addLane({ key: String(option.number), label: option.name, stage: option.number, department: null });
    }
  } else if (shifts.length === 0) {
    for (const option of SHIFT_DEPARTMENT_OPTIONS) {
      addLane({ key: option.value, label: option.label, stage: null, department: option.value });
    }
  }

  const laneKeyOf = (shift: ShiftWithAssignments): string =>
    laneBy === "stage" ? (shift.stage ? String(shift.stage) : NO_LANE) : (normalizeShiftDepartment(shift.department) ?? NO_LANE);

  for (const shift of shifts) {
    const key = laneKeyOf(shift);
    if (!lanes.has(key)) {
      if (laneBy === "stage") {
        addLane(
          key === NO_LANE
            ? { key, label: "Sin stage", stage: null, department: null }
            : { key, label: shiftStageLabel(shift.stage, stageOptions), stage: shift.stage ?? null, department: null },
        );
      } else {
        addLane(
          key === NO_LANE
            ? { key, label: "Sin departamento", stage: null, department: null }
            : { key, label: shiftDepartmentLabel(key), stage: null, department: key },
        );
      }
    }
    lanes.get(key)?.items.push(toItem(shift, dayStartTime));
  }

  const ordered = [...lanes.values()];
  if (laneBy === "department") {
    const rank = (lane: BoardLane) =>
      lane.department ? SHIFT_DEPARTMENT_OPTIONS.findIndex((option) => option.value === lane.department) : Number.MAX_SAFE_INTEGER;
    ordered.sort((a, b) => rank(a) - rank(b));
  } else {
    // "Sin stage" last, after every numbered stage (which `lanes` already holds in order).
    ordered.sort((a, b) => (a.stage ?? Number.MAX_SAFE_INTEGER) - (b.stage ?? Number.MAX_SAFE_INTEGER));
  }
  for (const lane of ordered) packColumns(lane.items);

  return { lanes: ordered, hours: boardHourMarks(dayStartTime) };
};

/**
 * The times of a shift started by clicking an empty spot of a lane: the click rounded down to the
 * snap step, one default-length shift long (cut at the day's end).
 */
export const shiftTimesFromBoardClick = (
  offsetMinutes: number,
  dayStartTime: string,
): { start_time: string; end_time: string } => {
  const start = Math.min(
    Math.max(Math.floor(offsetMinutes / BOARD_SNAP_MINUTES) * BOARD_SNAP_MINUTES, 0),
    MINUTES_PER_DAY - BOARD_SNAP_MINUTES,
  );
  const end = Math.min(start + BOARD_DEFAULT_SHIFT_MINUTES, MINUTES_PER_DAY);
  return { start_time: boardOffsetToClock(start, dayStartTime), end_time: boardOffsetToClock(end, dayStartTime) };
};

/** What a shift created from a lane's "add" button gets: the lane's stage or department (times stay the form defaults). */
export const lanePrefill = (lane: BoardLane) => ({
  stage: lane.stage ? String(lane.stage) : undefined,
  department: lane.department ?? undefined,
});

/** Display name of everyone on the shift, internal and external. */
export const shiftCrewNames = (shift: ShiftWithAssignments): string[] =>
  shift.assignments.map(
    (assignment) =>
      assignment.external_technician_name ||
      [assignment.profiles?.first_name, assignment.profiles?.last_name].filter(Boolean).join(" ").trim() ||
      assignment.profiles?.nickname ||
      "Sin nombre",
  );

/** "Ana, Luis +2": the first names that fit, then how many more. */
export const summarizeCrew = (names: readonly string[], max = 3): string => {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max}`;
};

/** A colour stripe per department, so a mixed board reads at a glance. */
const DEPARTMENT_STRIPE: Record<string, string> = {
  sound: "border-l-sky-500",
  lights: "border-l-amber-500",
  video: "border-l-violet-500",
  production: "border-l-emerald-500",
  logistics: "border-l-slate-500",
};
export const departmentStripe = (department: string | null | undefined) =>
  DEPARTMENT_STRIPE[normalizeShiftDepartment(department) ?? ""] ?? "border-l-border";

/** The accessible name of a shift block or card: what it is, when, and who is on it. */
export const shiftAriaLabel = (shift: ShiftWithAssignments): string => {
  const crew = shift.assignments.length;
  return `${shift.name}, de ${formatShiftTime(shift.start_time)} a ${formatShiftTime(shift.end_time)}, ${
    crew === 0 ? "sin personal" : crew === 1 ? "1 persona" : `${crew} personas`
  }`;
};
