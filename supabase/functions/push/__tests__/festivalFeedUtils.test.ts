import { describe, expect, it } from "vitest";
import {
  buildAssignedStagesByUserJob,
  buildAssignedUsersByShift,
  buildFestivalFeedArtistEvents,
  buildFestivalFeedPayload,
  buildFestivalFeedShiftEvents,
  buildFestivalFeedUrl,
  isDueInWindow,
  resolveArtistRecipients,
  resolveShiftRecipients,
  zonedDateTimeToUtc,
  type FestivalFeedArtist,
  type FestivalFeedShift,
  type FestivalFeedShiftAssignment,
  type FestivalFeedSubscription,
} from "../festivalFeedUtils.ts";

const artistBase: FestivalFeedArtist = {
  id: "artist-1",
  job_id: "job-1",
  name: "La Banda",
  date: "2026-07-03",
  stage: 2,
  show_start: "22:00:00",
  soundcheck: true,
  soundcheck_start: "18:00:00",
  line_check: true,
  line_check_start: "21:30:00",
  timezone: "Europe/Madrid",
  isaftermidnight: false,
};

describe("festival feed event generation", () => {
  it("builds soundcheck, line check, and show artist moments with Spanish copy", () => {
    const stageNames = new Map([["job-1:2", "Escenario Norte"]]);
    const events = buildFestivalFeedArtistEvents([artistBase], stageNames);

    expect(events).toHaveLength(6);
    expect(events.map((event) => event.eventKind)).toEqual([
      "soundcheck_15",
      "soundcheck_now",
      "linecheck_15",
      "linecheck_now",
      "show_15",
      "show_now",
    ]);
    expect(events.find((event) => event.eventKind === "linecheck_15")).toMatchObject({
      title: "Line check en 15 min",
      body: "En 15 min empieza el line check de La Banda en Escenario Norte.",
    });
    expect(events.find((event) => event.eventKind === "show_15")?.body)
      .toContain("Próximo artista en Escenario Norte");
    expect(events[0].eventKey).toContain("artist:artist-1:soundcheck_15:");
  });

  it("skips soundcheck moments when the soundcheck flag is off despite a stale start time", () => {
    const events = buildFestivalFeedArtistEvents([
      {
        ...artistBase,
        soundcheck: false,
        soundcheck_start: "09:30:00",
      },
    ]);

    expect(events.map((event) => event.eventKind)).toEqual([
      "linecheck_15",
      "linecheck_now",
      "show_15",
      "show_now",
    ]);
  });

  it("skips line check moments when the line check flag is off despite a stale start time", () => {
    const events = buildFestivalFeedArtistEvents([
      {
        ...artistBase,
        line_check: false,
        line_check_start: "21:30:00",
      },
    ]);

    expect(events.map((event) => event.eventKind)).toEqual([
      "soundcheck_15",
      "soundcheck_now",
      "show_15",
      "show_now",
    ]);
  });

  it("uses Madrid timezone and moves line check/show after midnight to the next civil day", () => {
    const events = buildFestivalFeedArtistEvents([
      {
        ...artistBase,
        soundcheck_start: "20:00:00",
        line_check_start: "00:30:00",
        show_start: "01:00:00",
        isaftermidnight: true,
      },
    ]);

    expect(events.find((event) => event.eventKind === "soundcheck_now")?.dueAt.toISOString())
      .toBe("2026-07-03T18:00:00.000Z");
    expect(events.find((event) => event.eventKind === "linecheck_now")?.dueAt.toISOString())
      .toBe("2026-07-03T22:30:00.000Z");
    expect(events.find((event) => event.eventKind === "show_15")?.dueAt.toISOString())
      .toBe("2026-07-03T22:45:00.000Z");
    expect(events.find((event) => event.eventKind === "show_now")?.urlDate)
      .toBe("2026-07-03");
  });

  it("builds shift start/end/ended moments across midnight", () => {
    const shift: FestivalFeedShift = {
      id: "shift-1",
      job_id: "job-1",
      date: "2026-07-03",
      stage: 2,
      name: "Turno escenario norte",
      start_time: "23:30:00",
      end_time: "01:30:00",
    };

    const events = buildFestivalFeedShiftEvents([shift], new Map([["job-1:2", "Escenario Norte"]]));

    expect(events.map((event) => event.eventKind)).toEqual([
      "shift_start_15",
      "shift_end_15",
      "shift_end_now",
    ]);
    expect(events.find((event) => event.eventKind === "shift_start_15")?.dueAt.toISOString())
      .toBe("2026-07-03T21:15:00.000Z");
    expect(events.find((event) => event.eventKind === "shift_end_now")?.dueAt.toISOString())
      .toBe("2026-07-03T23:30:00.000Z");
    expect(events.find((event) => event.eventKind === "shift_end_now")?.body)
      .toBe("Tu turno ha acabado, muchas gracias por el trabajo y no olvides firmar tus horas.");
  });

  it("matches due events inside the scheduler tolerance window", () => {
    const now = new Date("2026-07-03T20:00:00.000Z");
    expect(isDueInWindow(new Date("2026-07-03T19:59:00.000Z"), now)).toBe(true);
    expect(isDueInWindow(new Date("2026-07-03T20:00:04.000Z"), now)).toBe(true);
    expect(isDueInWindow(new Date("2026-07-03T19:58:54.000Z"), now)).toBe(false);
  });

  it("converts Madrid local datetimes to UTC across summer time", () => {
    expect(zonedDateTimeToUtc("2026-07-03", "18:00:00", "Europe/Madrid")?.toISOString())
      .toBe("2026-07-03T16:00:00.000Z");
  });
});

describe("festival feed recipient targeting", () => {
  const subscriptions: FestivalFeedSubscription[] = [
    { user_id: "admin-1", job_id: "job-1", enabled: true, stages: [2], role: "admin" },
    { user_id: "manager-1", job_id: "job-1", enabled: true, stages: [2], role: "management" },
    { user_id: "tech-1", job_id: "job-1", enabled: true, stages: [2], role: "technician" },
    { user_id: "house-1", job_id: "job-1", enabled: true, stages: [2], role: "house_tech" },
    { user_id: "tech-disabled", job_id: "job-1", enabled: false, stages: [2], role: "technician" },
  ];

  it("allows admin/management unassigned artist subscriptions but keeps technician/house_tech stage-strict", () => {
    const [event] = buildFestivalFeedArtistEvents([artistBase]);
    const assignments: FestivalFeedShiftAssignment[] = [
      { shift_id: "shift-stage-2", technician_id: "tech-1" },
      { shift_id: "shift-stage-1", technician_id: "house-1" },
    ];
    const shifts: FestivalFeedShift[] = [
      {
        id: "shift-stage-2",
        job_id: "job-1",
        date: "2026-07-03",
        stage: 2,
        name: "Stage 2",
        start_time: "18:00:00",
        end_time: "23:00:00",
      },
      {
        id: "shift-stage-1",
        job_id: "job-1",
        date: "2026-07-03",
        stage: 1,
        name: "Stage 1",
        start_time: "18:00:00",
        end_time: "23:00:00",
      },
    ];

    const recipients = resolveArtistRecipients(
      event,
      subscriptions,
      buildAssignedStagesByUserJob(shifts, assignments),
    );

    expect(recipients.map((recipient) => recipient.user_id)).toEqual([
      "admin-1",
      "manager-1",
      "tech-1",
    ]);
  });

  it("sends shift reminders only to users assigned to the exact shift", () => {
    const [event] = buildFestivalFeedShiftEvents([
      {
        id: "shift-1",
        job_id: "job-1",
        date: "2026-07-03",
        stage: 2,
        name: "Stage 2",
        start_time: "18:00:00",
        end_time: "23:00:00",
      },
    ]);
    const assignments: FestivalFeedShiftAssignment[] = [
      { shift_id: "shift-1", technician_id: "tech-1" },
      { shift_id: "shift-1", technician_id: null },
      { shift_id: "other-shift", technician_id: "admin-1" },
    ];

    const recipients = resolveShiftRecipients(
      event,
      subscriptions,
      buildAssignedUsersByShift(assignments),
    );

    expect(recipients.map((recipient) => recipient.user_id)).toEqual(["tech-1"]);
  });
});

describe("festival feed deep links", () => {
  it("routes technicians through TechSuperApp with date and stage filters", () => {
    expect(buildFestivalFeedUrl("technician", "job-1", "2026-07-03", 2))
      .toBe("/tech-app?open=artists&jobId=job-1&date=2026-07-03&stage=2");
  });

  it("routes admin, management, and house tech through festival management artist filters", () => {
    expect(buildFestivalFeedUrl("admin", "job-1", "2026-07-03", 2))
      .toBe("/festival-management/job-1/artists?date=2026-07-03&stage=2");
    expect(buildFestivalFeedUrl("house_tech", "job-1", "2026-07-03", 2))
      .toBe("/festival-management/job-1/artists?date=2026-07-03&stage=2");
  });

  it("puts dedupe metadata in the payload", () => {
    const [event] = buildFestivalFeedArtistEvents([artistBase]);
    const payload = buildFestivalFeedPayload(event, {
      user_id: "tech-1",
      job_id: "job-1",
      enabled: true,
      stages: [2],
      role: "technician",
    });

    expect(payload.meta).toMatchObject({
      eventKey: event.eventKey,
      eventKind: event.eventKind,
      jobId: "job-1",
      artistId: "artist-1",
      stage: 2,
    });
  });
});
