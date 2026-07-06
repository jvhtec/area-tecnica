import { describe, expect, it } from "vitest";
import {
  backfillMissingRowIds,
  buildProgramaDueEvents,
  buildProgramaMessage,
  buildProgramaPayload,
  deriveAssignmentDepartments,
  resolveProgramaRecipients,
  type ProgramaAssignment,
  type ProgramaJob,
  type ProgramaProgramDay,
} from "../programaFeedUtils.ts";

// Times land at midday UTC (~14:00 Madrid summer time) so the Madrid-timezone
// date-key conversion never crosses a day boundary in a way that would make the
// fixture's implied [start, end] range ambiguous.
const job: ProgramaJob = {
  id: "job-1",
  title: "Concierto Sala X",
  start_time: "2026-07-05T10:00:00.000Z",
  end_time: "2026-07-08T10:00:00.000Z",
};

describe("programa feed due-event generation", () => {
  it("builds one event for a dated day row marked to notify", () => {
    const days: ProgramaProgramDay[] = [
      { date: "2026-07-06", rows: [{ id: "row-1", time: "18:00", item: "Soundcheck", notify: true }] },
    ];

    const events = buildProgramaDueEvents(job, days, new Date("2026-07-06T10:00:00.000Z"));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventKey: "programa:job-1:row-1:2026-07-06",
      jobId: "job-1",
      dateKey: "2026-07-06",
      item: "Soundcheck",
    });
    expect(events[0].dueAt.toISOString()).toBe("2026-07-06T16:00:00.000Z");
  });

  it("ignores rows that are not marked to notify, lack an id, or have an invalid time", () => {
    const days: ProgramaProgramDay[] = [
      {
        date: "2026-07-06",
        rows: [
          { id: "row-1", time: "18:00", item: "Lunch" }, // notify not set
          { time: "18:00", item: "No id", notify: true },
          { id: "row-2", time: "not-a-time", item: "Bad time", notify: true },
        ],
      },
    ];

    const events = buildProgramaDueEvents(job, days, new Date("2026-07-06T10:00:00.000Z"));
    expect(events).toHaveLength(0);
  });

  it("recurs an undated row across every candidate date that falls within the job's run", () => {
    const days: ProgramaProgramDay[] = [
      { rows: [{ id: "row-1", time: "21:00", item: "Show Start", notify: true }] },
    ];

    // "now" sits in the middle of the job's run; candidate window is yesterday/today/tomorrow,
    // all of which fall inside [2026-07-05, 2026-07-08].
    const events = buildProgramaDueEvents(job, days, new Date("2026-07-06T12:00:00.000Z"));

    expect(events.map((event) => event.dateKey).sort()).toEqual([
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
    ]);
  });

  it("does not generate an undated recurrence for a candidate date outside the job's run", () => {
    const days: ProgramaProgramDay[] = [
      { rows: [{ id: "row-1", time: "21:00", item: "Show Start", notify: true }] },
    ];

    // "now" is the last day of the run; tomorrow falls outside [2026-07-05, 2026-07-08].
    const events = buildProgramaDueEvents(job, days, new Date("2026-07-08T12:00:00.000Z"));

    expect(events.map((event) => event.dateKey).sort()).toEqual([
      "2026-07-07",
      "2026-07-08",
    ]);
  });
});

describe("programa feed recipient targeting", () => {
  const baseAssignment: ProgramaAssignment = {
    technician_id: "tech-1",
    status: "confirmed",
    sound_role: null,
    lights_role: null,
    video_role: null,
    production_role: null,
    department: null,
    push_notifications_enabled: true,
  };

  it("derives department from whichever role column is active", () => {
    expect(deriveAssignmentDepartments({ ...baseAssignment, sound_role: "FOH" })).toEqual(["sound"]);
    expect(deriveAssignmentDepartments({ ...baseAssignment, lights_role: "none" })).toEqual([]);
  });

  it("falls back to the technician's profile department when no role column is set", () => {
    expect(deriveAssignmentDepartments({ ...baseAssignment, department: "logistics" })).toEqual([
      "logistics",
    ]);
  });

  it("excludes assignments that are not confirmed or have push disabled", () => {
    const [event] = buildProgramaDueEvents(
      job,
      [{ date: "2026-07-06", rows: [{ id: "row-1", time: "18:00", item: "Soundcheck", notify: true }] }],
      new Date("2026-07-06T10:00:00.000Z"),
    );

    const assignments: ProgramaAssignment[] = [
      { ...baseAssignment, technician_id: "confirmed-enabled", sound_role: "FOH" },
      { ...baseAssignment, technician_id: "invited", status: "invited", sound_role: "FOH" },
      { ...baseAssignment, technician_id: "push-off", push_notifications_enabled: false, sound_role: "FOH" },
    ];

    const recipients = resolveProgramaRecipients(event, assignments);
    expect(recipients.map((recipient) => recipient.technician_id)).toEqual(["confirmed-enabled"]);
  });

  it("scopes recipients to the row's departments when set, and broadcasts when empty", () => {
    const [event] = buildProgramaDueEvents(
      job,
      [
        {
          date: "2026-07-06",
          rows: [{ id: "row-1", time: "18:00", item: "Lighting Focus", notify: true, departments: ["lights"] }],
        },
      ],
      new Date("2026-07-06T10:00:00.000Z"),
    );

    const assignments: ProgramaAssignment[] = [
      { ...baseAssignment, technician_id: "lx-tech", lights_role: "LD" },
      { ...baseAssignment, technician_id: "sound-tech", sound_role: "FOH" },
    ];

    expect(resolveProgramaRecipients(event, assignments).map((r) => r.technician_id)).toEqual(["lx-tech"]);

    const [undeptEvent] = buildProgramaDueEvents(
      job,
      [{ date: "2026-07-06", rows: [{ id: "row-2", time: "19:00", item: "Doors", notify: true }] }],
      new Date("2026-07-06T10:00:00.000Z"),
    );
    expect(resolveProgramaRecipients(undeptEvent, assignments).map((r) => r.technician_id)).toEqual([
      "lx-tech",
      "sound-tech",
    ]);
  });

  it("normalizes department casing so it matches the lowercased values deriveAssignmentDepartments produces", () => {
    const [event] = buildProgramaDueEvents(
      job,
      [
        {
          date: "2026-07-06",
          rows: [{ id: "row-1", time: "18:00", item: "Lighting Focus", notify: true, departments: [" Lights " as never] }],
        },
      ],
      new Date("2026-07-06T10:00:00.000Z"),
    );

    expect(event.departments).toEqual(["lights"]);

    const assignments: ProgramaAssignment[] = [
      { ...baseAssignment, technician_id: "lx-tech", lights_role: "LD" },
    ];
    expect(resolveProgramaRecipients(event, assignments).map((r) => r.technician_id)).toEqual(["lx-tech"]);
  });

  it("broadcasts instead of silently dropping recipients when every stored department value is unrecognized", () => {
    const [event] = buildProgramaDueEvents(
      job,
      [
        {
          date: "2026-07-06",
          rows: [{ id: "row-1", time: "18:00", item: "Legacy row", notify: true, departments: ["FOH/Security" as never] }],
        },
      ],
      new Date("2026-07-06T10:00:00.000Z"),
    );

    expect(event.departments).toEqual([]);

    const assignments: ProgramaAssignment[] = [
      { ...baseAssignment, technician_id: "lx-tech", lights_role: "LD" },
      { ...baseAssignment, technician_id: "sound-tech", sound_role: "FOH" },
    ];
    expect(resolveProgramaRecipients(event, assignments).map((r) => r.technician_id)).toEqual([
      "lx-tech",
      "sound-tech",
    ]);
  });
});

describe("programa feed legacy row id backfill", () => {
  it("assigns ids only to rows that are missing one and flags the result as changed", () => {
    const days: ProgramaProgramDay[] = [
      {
        date: "2026-07-06",
        rows: [
          { id: "row-1", time: "18:00", item: "Soundcheck" },
          { time: "19:00", item: "Doors" },
        ],
      },
    ];

    const result = backfillMissingRowIds(days);

    expect(result.changed).toBe(true);
    expect(result.days[0].rows?.[0].id).toBe("row-1");
    expect(result.days[0].rows?.[1].id).toEqual(expect.any(String));
    expect(result.days[0].rows?.[1].id).not.toBe("");
  });

  it("reports unchanged when every row already has an id", () => {
    const days: ProgramaProgramDay[] = [
      { date: "2026-07-06", rows: [{ id: "row-1", time: "18:00", item: "Soundcheck" }] },
    ];

    const result = backfillMissingRowIds(days);
    expect(result.changed).toBe(false);
    expect(result.days).toEqual(days);
  });

  it("handles missing/non-array input without throwing", () => {
    expect(backfillMissingRowIds(undefined)).toEqual({ days: [], changed: false });
    expect(backfillMissingRowIds(null)).toEqual({ days: [], changed: false });
  });
});

describe("programa feed message building", () => {
  it("builds Spanish reminder copy including the job title, item, and time", () => {
    const [event] = buildProgramaDueEvents(
      job,
      [{ date: "2026-07-06", rows: [{ id: "row-1", time: "18:00", item: "Soundcheck", notify: true, notes: "Traer in-ears" }] }],
      new Date("2026-07-06T10:00:00.000Z"),
    );

    const message = buildProgramaMessage(job, event);
    expect(message.title).toBe("Recordatorio de programa");
    expect(message.body).toBe("Concierto Sala X: Soundcheck a las 18:00 — Traer in-ears");

    const payload = buildProgramaPayload(job, event);
    expect(payload.meta).toMatchObject({ eventKey: event.eventKey, jobId: "job-1", rowId: "row-1" });
  });
});
