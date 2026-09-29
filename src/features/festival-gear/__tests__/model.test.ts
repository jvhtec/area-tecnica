import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildEmptyGearFormData,
  globalRowToFormData,
  stageRowToFormData,
  toGlobalGearPayload,
  toSectionFormData,
  toStageGearPayload,
} from "../model";

const globalRow = {
  id: "gear-1",
  job_id: "job-1",
  max_stages: 4,
  foh_consoles: [{ model: "SD12" }],
  mon_consoles: null,
  foh_drive_options: ["l_r"],
  foh_drive_positions: ["foh"],
  mon_positions: [],
  foh_waves_models: [],
  foh_outboard: null,
  mon_waves_models: [],
  mon_outboard: "LA2A",
  wireless_systems: [],
  iem_systems: [],
  wired_mics: [{ model: "SM58", quantity: 6 }],
  extras_wired: null,
  other_infrastructure: null,
  notes: null,
  available_monitors: 8,
  has_side_fills: true,
  has_drum_fills: false,
  has_dj_booths: null,
  available_cat6_runs: 2,
  available_hma_runs: 0,
  available_coax_runs: null,
  available_opticalcon_duo_runs: 0,
  available_analog_runs: 12,
} as unknown as Tables<"festival_gear_setups">;

const stageRow = {
  id: "stage-1",
  gear_setup_id: "gear-1",
  stage_number: 2,
  foh_consoles: [],
  mon_consoles: [],
  foh_drive_options: [],
  foh_drive_positions: [],
  mon_positions: [],
  foh_waves_models: [],
  mon_waves_models: [],
  wireless_systems: [],
  iem_systems: [],
  wired_mics: null,
  monitors_enabled: true,
  monitors_quantity: 3,
  extras_sf: null,
  infra_cat6: true,
  infra_cat6_quantity: 5,
  infra_analog: null,
  notes: "Escenario pequeño",
} as unknown as Tables<"festival_stage_gear_setups">;

describe("gear form mapping", () => {
  it("reads the festival-wide row's availability columns into toggles and quantities", () => {
    const form = globalRowToFormData(globalRow);
    expect(form).toMatchObject({
      max_stages: 4,
      monitors_enabled: true,
      monitors_quantity: 8,
      extras_sf: true,
      extras_df: false,
      extras_djbooth: false,
      infra_cat6: true,
      infra_cat6_quantity: 2,
      infra_hma: false,
      infra_coax: false,
      infra_analog: 12,
      mon_outboard: "LA2A",
      notes: "",
      wired_mics: [{ model: "SM58", quantity: 6 }],
    });
  });

  it("reads a stage override one to one and takes max_stages from the festival", () => {
    const form = stageRowToFormData(stageRow, 4);
    expect(form).toMatchObject({
      max_stages: 4,
      monitors_enabled: true,
      monitors_quantity: 3,
      extras_sf: false,
      infra_cat6: true,
      infra_cat6_quantity: 5,
      infra_analog: 0,
      wired_mics: [],
      notes: "Escenario pequeño",
    });
  });

  it("starts empty with the given stage count", () => {
    expect(buildEmptyGearFormData(3)).toMatchObject({ max_stages: 3, monitors_enabled: false, notes: "" });
  });
});

describe("gear save payloads", () => {
  it("stores a disabled toggle as zero availability on the festival-wide row", () => {
    const setup = {
      ...buildEmptyGearFormData(2),
      monitors_enabled: false,
      monitors_quantity: 6,
      infra_cat6: true,
      infra_cat6_quantity: 4,
      infra_analog: 10,
    };
    expect(toGlobalGearPayload(setup, "job-1", "gear-1")).toMatchObject({
      id: "gear-1",
      job_id: "job-1",
      max_stages: 2,
      available_monitors: 0,
      available_cat6_runs: 4,
      available_hma_runs: 0,
      available_analog_runs: 10,
    });
  });

  it("omits the id for a festival that has no setup yet", () => {
    expect(toGlobalGearPayload(buildEmptyGearFormData(), "job-1", null)).not.toHaveProperty("id");
  });

  it("keeps wired mics an array even if the form holds something else", () => {
    const setup = { ...buildEmptyGearFormData(), wired_mics: undefined } as never;
    expect(toGlobalGearPayload(setup, "job-1")).toMatchObject({ wired_mics: [] });
  });

  it("sends the stage override as plain columns, never the availability names", () => {
    const payload = toStageGearPayload({
      ...buildEmptyGearFormData(3),
      monitors_enabled: true,
      monitors_quantity: 2,
    }) as Record<string, unknown>;
    expect(payload).toMatchObject({ monitors_enabled: true, monitors_quantity: 2, infra_cat6: false });
    expect(payload).not.toHaveProperty("available_monitors");
    expect(payload).not.toHaveProperty("job_id");
    expect(payload).not.toHaveProperty("max_stages");
  });
});

describe("toSectionFormData", () => {
  it("keeps the gear fields and neutralises the artist-only ones", () => {
    const data = toSectionFormData({ ...buildEmptyGearFormData(), monitors_quantity: 4 }, 3);
    expect(data).toMatchObject({
      monitors_quantity: 4,
      stage: 3,
      name: "",
      foh_console_provided_by: "festival",
      wireless_provided_by: "festival",
      mic_kit: "band",
    });
  });
});
