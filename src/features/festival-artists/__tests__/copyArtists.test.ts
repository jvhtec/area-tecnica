import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildCopiedArtistRows,
  DEFAULT_COPY_ARTISTS_OPTIONS,
  type CopyArtistsOptions,
} from "../copyArtists";

const source = {
  id: "artist-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  job_id: "job-old",
  name: "Banda",
  date: "2026-07-10",
  stage: 3,
  show_start: "22:00",
  show_end: "23:00",
  soundcheck: true,
  soundcheck_date: "2026-07-09",
  soundcheck_start: "17:00",
  soundcheck_end: "18:00",
  line_check_start: "16:00",
  line_check_end: "16:30",
  load_in_time: "15:00",
  notes: "Sin bombo",
  foh_console: "SD12",
  foh_console_provided_by: "band",
  mon_console: "SD9",
  mon_console_provided_by: "band",
  monitors_from_foh: true,
  foh_drive: "usb",
  foh_drive_position: "left",
  mon_position: "right",
  foh_waves_models: [{ model: "SSL", quantity: 1 }],
  foh_outboard: "1176",
  foh_waves_provided_by: "band",
  mon_waves_models: [{ model: "CLA", quantity: 1 }],
  mon_outboard: "LA2A",
  mon_waves_provided_by: "band",
  wireless_systems: [{ model: "AD4D" }],
  wireless_provided_by: "band",
  iem_systems: [{ model: "PSM" }],
  iem_provided_by: "band",
  wired_mics: [{ model: "SM58", quantity: 4 }],
  infra_cat6: true,
} as unknown as Tables<"festival_artists">;

const target = { jobId: "job-new", date: "2026-08-20" };
const build = (options: Partial<CopyArtistsOptions> = {}) =>
  buildCopiedArtistRows([source], { ...DEFAULT_COPY_ARTISTS_OPTIONS, ...options }, target)[0];

describe("buildCopiedArtistRows", () => {
  it("re-targets the artist and drops identity and audit columns", () => {
    const row = build();
    expect(row).toMatchObject({ job_id: "job-new", date: "2026-08-20", name: "Banda" });
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("created_at");
    expect(row).not.toHaveProperty("updated_at");
  });

  it("flags the copied rider as outdated and remembers where it came from", () => {
    expect(build()).toMatchObject({
      rider_copied_from_date: "2026-07-10",
      rider_outdated: true,
      rider_outdated_dismissed: false,
    });
  });

  it("clears every time field by default", () => {
    expect(build()).toMatchObject({
      show_start: null,
      show_end: null,
      soundcheck_start: null,
      soundcheck_end: null,
      soundcheck_date: null,
      line_check_start: null,
      line_check_end: null,
      load_in_time: null,
    });
  });

  it("keeps times and moves the soundcheck by the same day offset when times are kept", () => {
    expect(build({ resetTimes: false })).toMatchObject({
      show_start: "22:00",
      show_end: "23:00",
      soundcheck_start: "17:00",
      load_in_time: "15:00",
      // one day before the show stays one day before the new show
      soundcheck_date: "2026-08-19",
    });
  });

  it("only resets the stage when asked", () => {
    expect(build().stage).toBe(3);
    expect(build({ resetStages: true }).stage).toBe(1);
  });

  it("drops notes unless they are copied", () => {
    expect(build().notes).toBe("Sin bombo");
    expect(build({ copyNotes: false }).notes).toBeNull();
  });

  it("clears the technical spec, falling back to festival-provided, when specs are not copied", () => {
    const row = build({ copyTechnicalSpecs: false });
    expect(row).toMatchObject({
      foh_console: null,
      foh_console_provided_by: "festival",
      mon_console: null,
      monitors_from_foh: false,
      foh_waves_models: [],
      mon_waves_models: [],
      wireless_systems: [],
      wireless_provided_by: "festival",
      iem_systems: [],
      wired_mics: [],
    });
  });

  it("keeps the technical spec by default and leaves other columns untouched", () => {
    expect(build()).toMatchObject({
      foh_console: "SD12",
      foh_console_provided_by: "band",
      wired_mics: [{ model: "SM58", quantity: 4 }],
      infra_cat6: true,
    });
  });
});
