import { describe, expect, it } from "vitest";

import { createInitialFormData } from "@/components/festival/artistRequirementsFormModel";
import { artistToFormState, computeLockedFields, parseRiderFiles, stageNameMap } from "../publicContext";

describe("computeLockedFields", () => {
  it("always locks the schedule identity, and nothing else for an empty artist", () => {
    expect([...computeLockedFields({})].sort()).toEqual(["date", "name", "show_end", "show_start", "stage"]);
  });

  it("locks a console together with who provides it, and monitors the same way", () => {
    const locked = computeLockedFields({ foh_console: "SSL L500", mon_console: "DiGiCo SD12" });
    expect(locked.has("foh_console")).toBe(true);
    expect(locked.has("foh_console_provided_by")).toBe(true);
    expect(locked.has("mon_console")).toBe(true);
    expect(locked.has("mon_console_provided_by")).toBe(true);
  });

  it("locks Waves by either models or an outboard note", () => {
    expect(computeLockedFields({ foh_outboard: "Distressors" }).has("foh_waves_provided_by")).toBe(true);
    expect(computeLockedFields({ mon_waves_models: ["SSL"] }).has("mon_waves_models")).toBe(true);
  });

  it("locks only the infrastructure pieces production filled, plus the provider", () => {
    const locked = computeLockedFields({ infra_cat6: true, infra_hma_quantity: 2, infra_analog: 0 });
    expect(locked.has("infra_cat6")).toBe(true);
    expect(locked.has("infra_hma_quantity")).toBe(true);
    expect(locked.has("infra_hma")).toBe(false);
    expect(locked.has("infra_analog")).toBe(false);
    expect(locked.has("infrastructure_provided_by")).toBe(true);
  });

  it("does not lock the infrastructure provider when nothing is filled", () => {
    expect(computeLockedFields({ infra_cat6: false }).has("infrastructure_provided_by")).toBe(false);
  });

  it("locks wireless and IEM only when a system has a model or a quantity", () => {
    expect(computeLockedFields({ wireless_systems: [{ model: "", quantity: 0 }] }).has("wireless_systems")).toBe(false);
    const locked = computeLockedFields({ iem_systems: [{ model: "", quantity_hh: 0, quantity_bp: 3 }] });
    expect(locked.has("iem_systems")).toBe(true);
    expect(locked.has("iem_provided_by")).toBe(true);
  });

  it("locks the mic kit for festival/mixed even without wired mics, but not for band", () => {
    expect(computeLockedFields({ mic_kit: "festival" }).has("mic_kit")).toBe(true);
    expect(computeLockedFields({ mic_kit: "band" }).has("mic_kit")).toBe(false);
    const withMics = computeLockedFields({ mic_kit: "band", wired_mics: [{ model: "SM58", quantity: 0 }] });
    expect(withMics.has("wired_mics")).toBe(true);
    expect(withMics.has("mic_kit")).toBe(true);
  });
});

describe("artistToFormState", () => {
  const prev = createInitialFormData(false);

  it("copies the artist's values and falls back to defaults for missing ones", () => {
    const next = artistToFormState({ name: "Los Planetas", stage: 0, date: "2026-07-10", show_start: "21:00:00" }, prev);
    expect(next.name).toBe("Los Planetas");
    expect(next.stage).toBe(1);
    expect(next.show_start).toBe("21:00");
    expect(next.soundcheck_date).toBe("2026-07-10");
    expect(next.mic_kit).toBe("band");
    expect(next.wired_mics).toEqual([]);
  });

  it("keeps the previous console rows when the artist has none, and uses the artist's when present", () => {
    expect(artistToFormState({}, prev).foh_consoles).toBe(prev.foh_consoles);
    expect(artistToFormState({ mic_kit: "mixed" }, prev).mic_kit).toBe("mixed");
  });

  it("keeps max_stages from the previous state when the artist does not carry it", () => {
    expect(artistToFormState({ max_stages: 4 }, prev).max_stages).toBe(4);
    expect(artistToFormState({}, { ...prev, max_stages: 3 }).max_stages).toBe(3);
  });
});

describe("parseRiderFiles and stageNameMap", () => {
  it("drops rider rows without an id or path and nulls empty optional fields", () => {
    expect(
      parseRiderFiles([
        { id: "a", file_name: "rider.pdf", file_path: "p/rider.pdf", file_size: 10, uploaded_by_name: "" },
        { id: "", file_name: "x", file_path: "p/x" },
        { id: "b", file_name: "y", file_path: "" },
      ]),
    ).toEqual([
      {
        id: "a",
        file_name: "rider.pdf",
        file_path: "p/rider.pdf",
        file_type: null,
        file_size: 10,
        uploaded_at: null,
        uploaded_by: null,
        uploaded_by_name: null,
      },
    ]);
    expect(parseRiderFiles(null)).toEqual([]);
  });

  it("maps only numbered, named stages", () => {
    expect(stageNameMap([{ number: 1, name: "Main" }, { number: 2, name: "" }, { name: "x" }, { number: 3, name: "Club" }])).toEqual({
      1: "Main",
      3: "Club",
    });
    expect(stageNameMap(null)).toEqual({});
  });
});
