import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, { data: unknown; error: unknown }>,
  rpc: vi.fn(),
  calls: [] as Array<{ table: string; op: string; args: unknown[] }>,
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: (table: string) => {
      const result = () => mocks.tables[table] ?? { data: [], error: null };
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "eq", "in", "order", "insert", "update", "delete", "single"]) {
        builder[op] = (...args: unknown[]) => {
          mocks.calls.push({ table, op, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      return builder;
    },
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  },
}));

import {
  addShiftAssignment,
  addShiftAssignments,
  createFestivalShift,
  deleteFestivalShift,
  fetchJobCrew,
  fetchShiftsForDate,
  removeShiftAssignment,
  updateShiftAssignmentRole,
} from "../api";

const shift = (id: string, start: string) => ({ id, job_id: "job-1", date: "2026-07-01", start_time: start, end_time: "23:00", name: id });

describe("festival scheduling api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    for (const key of Object.keys(mocks.tables)) delete mocks.tables[key];
    mocks.rpc.mockResolvedValue({ data: [], error: null });
  });

  describe("fetchShiftsForDate", () => {
    it("returns nothing, and reads no crew, for a day without shifts", async () => {
      mocks.tables.festival_shifts = { data: [], error: null };
      await expect(fetchShiftsForDate("job-1", "2026-07-01")).resolves.toEqual([]);
      expect(mocks.calls.some((call) => call.table === "festival_shift_assignments")).toBe(false);
    });

    it("attaches each shift's crew, with directory names for internal people only", async () => {
      mocks.tables.festival_shifts = { data: [shift("s1", "10:00"), shift("s2", "12:00")], error: null };
      mocks.tables.festival_shift_assignments = {
        data: [
          { id: "a1", shift_id: "s1", technician_id: "t1", external_technician_name: null, role: "sound-tech" },
          { id: "a2", shift_id: "s1", technician_id: null, external_technician_name: "Ana", role: "runner" },
          { id: "a3", shift_id: "s2", technician_id: "t1", external_technician_name: null, role: "sound-tech" },
        ],
        error: null,
      };
      mocks.rpc.mockResolvedValue({ data: [{ id: "t1", first_name: "Luis", last_name: "Mora", nickname: null, department: "sound", role: "technician" }], error: null });

      const shifts = await fetchShiftsForDate("job-1", "2026-07-01");

      expect(mocks.rpc).toHaveBeenCalledWith("get_profile_directory", { p_profile_ids: ["t1"] });
      expect(shifts.map((s) => [s.id, s.assignments.map((a) => a.id)])).toEqual([
        ["s1", ["a1", "a2"]],
        ["s2", ["a3"]],
      ]);
      expect(shifts[0].assignments[0].profiles?.first_name).toBe("Luis");
      expect(shifts[0].assignments[1].profiles).toBeNull();
    });

    it("does not ask the directory when only external people are scheduled", async () => {
      mocks.tables.festival_shifts = { data: [shift("s1", "10:00")], error: null };
      mocks.tables.festival_shift_assignments = {
        data: [{ id: "a1", shift_id: "s1", technician_id: null, external_technician_name: "Ana", role: "runner" }],
        error: null,
      };
      await fetchShiftsForDate("job-1", "2026-07-01");
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("fails instead of pretending the day is empty", async () => {
      mocks.tables.festival_shifts = { data: null, error: new Error("denied") };
      await expect(fetchShiftsForDate("job-1", "2026-07-01")).rejects.toThrow("denied");

      mocks.tables.festival_shifts = { data: [shift("s1", "10:00")], error: null };
      mocks.tables.festival_shift_assignments = { data: null, error: new Error("crew denied") };
      await expect(fetchShiftsForDate("job-1", "2026-07-01")).rejects.toThrow("crew denied");
    });
  });

  describe("writes", () => {
    it("throw the database error", async () => {
      mocks.tables.festival_shifts = { data: null, error: new Error("nope") };
      mocks.tables.festival_shift_assignments = { data: null, error: new Error("dup") };
      await expect(deleteFestivalShift("s1")).rejects.toThrow("nope");
      await expect(addShiftAssignment({ shift_id: "s1", role: "runner" })).rejects.toThrow("dup");
      await expect(removeShiftAssignment("a1")).rejects.toThrow("dup");
    });

    it("create a shift and return the saved row so the caller can keep working on it", async () => {
      mocks.tables.festival_shifts = { data: { id: "new", name: "Montaje" }, error: null };

      const created = await createFestivalShift({ job_id: "job-1", date: "2026-07-01", name: "Montaje", start_time: "09:00", end_time: "17:00" });

      expect(created).toEqual({ id: "new", name: "Montaje" });
      expect(mocks.calls.map((call) => call.op)).toEqual(expect.arrayContaining(["insert", "select", "single"]));

      mocks.tables.festival_shifts = { data: null, error: new Error("denied") };
      await expect(createFestivalShift({ job_id: "job-1", date: "2026-07-01", name: "x", start_time: "09:00", end_time: "17:00" })).rejects.toThrow("denied");
    });

    it("add several people in one statement, and nothing at all for an empty list", async () => {
      const rows = [
        { shift_id: "s1", technician_id: "t1", role: "runner" },
        { shift_id: "s1", external_technician_name: "Ana", role: "runner" },
      ];
      await addShiftAssignments(rows);
      const inserts = mocks.calls.filter((call) => call.table === "festival_shift_assignments" && call.op === "insert");
      expect(inserts).toEqual([{ table: "festival_shift_assignments", op: "insert", args: [rows] }]);

      mocks.calls.length = 0;
      await addShiftAssignments([]);
      expect(mocks.calls).toEqual([]);

      mocks.tables.festival_shift_assignments = { data: null, error: new Error("dup") };
      await expect(addShiftAssignments(rows)).rejects.toThrow("dup");
    });

    it("change a person's role by assignment id", async () => {
      await updateShiftAssignmentRole("a1", "SND-FOH-R");
      expect(mocks.calls).toContainEqual({ table: "festival_shift_assignments", op: "update", args: [{ role: "SND-FOH-R" }] });
      expect(mocks.calls).toContainEqual({ table: "festival_shift_assignments", op: "eq", args: ["id", "a1"] });
    });

    it("delete the shift by id", async () => {
      await deleteFestivalShift("s1");
      expect(mocks.calls).toContainEqual({ table: "festival_shifts", op: "delete", args: [] });
      expect(mocks.calls).toContainEqual({ table: "festival_shifts", op: "eq", args: ["id", "s1"] });
    });
  });

  describe("fetchJobCrew", () => {
    it("lists the external names used on the festival once each, sorted", async () => {
      mocks.tables.job_assignments = { data: [], error: null };
      mocks.tables.festival_shift_assignments = {
        data: [
          { external_technician_name: " Zoe " },
          { external_technician_name: "Ana" },
          { external_technician_name: "Ana" },
          { external_technician_name: null },
        ],
        error: null,
      };

      const crew = await fetchJobCrew("job-1");

      expect(crew.externalNames).toEqual(["Ana", "Zoe"]);
      expect(crew.jobAssignments).toEqual([]);
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("reads display names of the job's crew from the directory", async () => {
      mocks.tables.job_assignments = { data: [{ technician_id: "t1", status: "confirmed" }, { technician_id: "t1", status: "pending" }], error: null };
      mocks.tables.festival_shift_assignments = { data: [], error: null };
      mocks.rpc.mockResolvedValue({ data: [{ id: "t1" }], error: null });

      const crew = await fetchJobCrew("job-1");

      expect(mocks.rpc).toHaveBeenCalledWith("get_profile_directory", { p_profile_ids: ["t1"] });
      expect(crew.directory).toEqual([{ id: "t1" }]);
    });
  });
});
