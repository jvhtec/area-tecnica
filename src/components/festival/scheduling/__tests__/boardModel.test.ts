import { describe, expect, it } from "vitest";

import type { ShiftWithAssignments } from "@/types/festival-scheduling";

import {
  boardHourMarks,
  boardOffsetToClock,
  buildDayBoard,
  departmentStripe,
  lanePrefill,
  shiftAriaLabel,
  shiftCrewNames,
  shiftTimesFromBoardClick,
  summarizeCrew,
} from "../boardModel";

const shift = (
  id: string,
  start_time: string,
  end_time: string,
  extra: Partial<ShiftWithAssignments> = {},
): ShiftWithAssignments => ({
  id,
  job_id: "job-1",
  date: "2031-07-10",
  name: id,
  start_time,
  end_time,
  stage: 1,
  department: "sound",
  assignments: [],
  ...extra,
});

const stages = [
  { number: 1, name: "Principal" },
  { number: 2, name: "Carpa" },
];

const board = (shifts: ShiftWithAssignments[], laneBy: "stage" | "department" = "stage", dayStartTime = "07:00") =>
  buildDayBoard({ shifts, dayStartTime, laneBy, stageOptions: stages });

describe("clock positions", () => {
  it("maps a position on the board to the clock, wrapping past midnight", () => {
    expect(boardOffsetToClock(0, "07:00")).toBe("07:00");
    expect(boardOffsetToClock(150, "07:00")).toBe("09:30");
    expect(boardOffsetToClock(17 * 60, "07:00")).toBe("00:00");
    expect(boardOffsetToClock(24 * 60, "07:00")).toBe("07:00");
  });

  it("marks every hour of the festival day starting at the day start", () => {
    const marks = boardHourMarks("06:00");
    expect(marks).toHaveLength(24);
    expect(marks[0]).toEqual({ offset: 0, label: "06:00" });
    expect(marks[18].label).toBe("00:00");
    expect(marks[23].label).toBe("05:00");
  });
});

describe("buildDayBoard by stage", () => {
  it("has a lane for every stage of the festival, empty ones too, in order", () => {
    const { lanes } = board([shift("a", "10:00", "12:00", { stage: 2 })]);
    expect(lanes.map((lane) => [lane.key, lane.label, lane.items.length])).toEqual([
      ["1", "Principal", 0],
      ["2", "Carpa", 1],
    ]);
    expect(lanes[0]).toMatchObject({ stage: 1, department: null });
  });

  it("puts shifts without a stage last, and keeps a stage the festival no longer lists", () => {
    const { lanes } = board([
      shift("none", "10:00", "12:00", { stage: null }),
      shift("old", "10:00", "12:00", { stage: 5 }),
    ]);
    expect(lanes.map((lane) => lane.label)).toEqual(["Principal", "Carpa", "Stage 5", "Sin stage"]);
  });

  it("positions shifts from the festival day start, overnight ones included", () => {
    const [main] = board([
      shift("morning", "09:00", "11:30"),
      shift("night", "22:00", "02:00"),
      shift("dawn", "03:00", "05:00"),
    ]).lanes;
    const byId = Object.fromEntries(main.items.map((item) => [item.shift.id, item]));

    expect(byId.morning).toMatchObject({ start: 120, end: 270, clipped: false });
    // 22:00 is 15 h after 07:00; it runs 4 h, to 02:00 the next calendar day, still inside the day.
    expect(byId.night).toMatchObject({ start: 900, end: 1140, clipped: false });
    // 03:00 belongs to the end of the festival day (20 h in) and 2 h later is still before 07:00.
    expect(byId.dawn).toMatchObject({ start: 1200, end: 1320, clipped: false });
  });

  it("marks a shift that runs past the next day start as clipped", () => {
    const [main] = board([shift("late", "05:00", "09:00")]).lanes;
    expect(main.items[0]).toMatchObject({ start: 1320, end: 1560, clipped: true });
  });

  it("lays overlapping shifts of a lane side by side and lets a later one reuse the width", () => {
    const [main] = board([
      shift("a", "10:00", "14:00"),
      shift("b", "11:00", "13:00"),
      shift("c", "13:00", "15:00"),
      shift("d", "16:00", "18:00"),
    ]).lanes;
    const layout = Object.fromEntries(main.items.map((item) => [item.shift.id, [item.column, item.columns]]));

    // a and b overlap; c starts when b ends, so it takes b's column but the group is still 2 wide.
    expect(layout).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2], d: [0, 1] });
  });

  it("does not overlap shifts of different lanes", () => {
    const lanes = board([shift("a", "10:00", "14:00"), shift("b", "10:00", "14:00", { stage: 2 })]).lanes;
    expect(lanes.map((lane) => lane.items.map((item) => item.columns))).toEqual([[1], [1]]);
  });
});

describe("buildDayBoard by department", () => {
  it("has a lane per department in use, in the usual order, and Sin departamento last", () => {
    const { lanes } = board(
      [
        shift("l", "10:00", "12:00", { department: "lights" }),
        shift("n", "10:00", "12:00", { department: null }),
        shift("s", "10:00", "12:00", { department: "sound" }),
        shift("p", "10:00", "12:00", { department: "produccion" }),
      ],
      "department",
    );
    expect(lanes.map((lane) => [lane.key, lane.label])).toEqual([
      ["sound", "Sonido"],
      ["lights", "Luces"],
      ["production", "Producción"],
      ["none", "Sin departamento"],
    ]);
  });

  it("offers every department while the day is empty, so a shift can be started in any", () => {
    expect(board([], "department").lanes.map((lane) => lane.key)).toEqual([
      "sound",
      "lights",
      "video",
      "production",
      "logistics",
    ]);
  });
});

describe("creating from the board", () => {
  it("rounds a click down to the half hour and makes a one-hour shift", () => {
    expect(shiftTimesFromBoardClick(2 * 60 + 20, "07:00")).toEqual({ start_time: "09:00", end_time: "10:00" });
    expect(shiftTimesFromBoardClick(2 * 60 + 40, "07:00")).toEqual({ start_time: "09:30", end_time: "10:30" });
  });

  it("stays inside the day and reads past midnight as the clock", () => {
    expect(shiftTimesFromBoardClick(-30, "07:00")).toEqual({ start_time: "07:00", end_time: "08:00" });
    expect(shiftTimesFromBoardClick(18 * 60, "07:00")).toEqual({ start_time: "01:00", end_time: "02:00" });
    expect(shiftTimesFromBoardClick(24 * 60 + 500, "07:00")).toEqual({ start_time: "06:30", end_time: "07:00" });
  });

  it("gives a lane's stage or department to the new shift", () => {
    const lanes = board([shift("a", "10:00", "12:00", { department: "lights" })], "stage").lanes;
    expect(lanePrefill(lanes[1])).toEqual({ stage: "2", department: undefined });
    const byDepartment = board([shift("a", "10:00", "12:00", { department: "lights" })], "department").lanes;
    expect(lanePrefill(byDepartment[0])).toEqual({ stage: undefined, department: "lights" });
  });
});

describe("shift labels", () => {
  const withCrew = (assignments: ShiftWithAssignments["assignments"]) => shift("a", "10:00", "12:00", { assignments });
  const person = (id: string, first: string, last: string) => ({
    id,
    shift_id: "a",
    role: "x",
    technician_id: id,
    profiles: { id, first_name: first, last_name: last, department: "sound", role: "technician" },
  });

  it("names everyone on the shift, internal and external", () => {
    const crew = withCrew([
      person("t1", "Ana", "Ruiz"),
      { id: "e1", shift_id: "a", role: "x", external_technician_name: "Pepe" },
      { id: "u1", shift_id: "a", role: "x", technician_id: "gone", profiles: null },
    ]);
    expect(shiftCrewNames(crew)).toEqual(["Ana Ruiz", "Pepe", "Sin nombre"]);
  });

  it("summarises a long crew as the first names and a count", () => {
    expect(summarizeCrew(["A", "B"])).toBe("A, B");
    expect(summarizeCrew(["A", "B", "C", "D", "E"])).toBe("A, B, C +2");
    expect(summarizeCrew(["A", "B", "C", "D", "E"], 4)).toBe("A, B, C, D +1");
    expect(summarizeCrew([])).toBe("");
  });

  it("describes a shift for a screen reader", () => {
    expect(shiftAriaLabel(shift("Montaje", "09:00:00", "17:00:00"))).toBe("Montaje, de 09:00 a 17:00, sin personal");
    expect(shiftAriaLabel(withCrew([person("t1", "A", "B")]))).toBe("a, de 10:00 a 12:00, 1 persona");
    expect(shiftAriaLabel(withCrew([person("t1", "A", "B"), person("t2", "C", "D")]))).toContain("2 personas");
  });

  it("stripes shifts by department, with production spelled either way", () => {
    expect(departmentStripe("sound")).not.toBe(departmentStripe("lights"));
    expect(departmentStripe("producción")).toBe(departmentStripe("production"));
    expect(departmentStripe(null)).toBe("border-l-border");
  });
});
