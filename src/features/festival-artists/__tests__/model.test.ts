import { describe, expect, it } from "vitest";
import {
  ARTIST_CATEGORY_FIELDS,
  artistFormSchema,
  toArtistCategoryPatch,
  toArtistFormValues,
} from "../model";

describe("toArtistFormValues", () => {
  it("gives a new artist the shared defaults and marks the rider as missing", () => {
    const values = toArtistFormValues(undefined, { selectedDate: "2026-07-10" });
    expect(values).toMatchObject({
      name: "",
      stage: 1,
      date: "2026-07-10",
      soundcheck_date: "2026-07-10",
      show_start: "20:00",
      show_end: "21:00",
      soundcheck_start: "18:00",
      soundcheck_end: "19:00",
      foh_console_provided_by: "festival",
      mic_kit: "festival",
      rider_missing: true,
    });
  });

  it("keeps rider_missing from the row and never forces it for existing artists", () => {
    expect(toArtistFormValues({ name: "A" }).rider_missing).toBe(false);
    expect(toArtistFormValues({ rider_missing: true }).rider_missing).toBe(true);
    expect(toArtistFormValues({ rider_missing: null }).rider_missing).toBe(false);
  });

  it("treats null columns as defaults instead of leaking nulls into the form", () => {
    const values = toArtistFormValues({
      name: null,
      stage: null,
      show_start: null,
      wireless_systems: null,
      monitors_quantity: null,
      mic_kit: "bogus",
    });
    expect(values.name).toBe("");
    expect(values.stage).toBe(1);
    expect(values.show_start).toBe("20:00");
    expect(values.wireless_systems).toEqual([]);
    expect(values.monitors_quantity).toBe(0);
    expect(values.mic_kit).toBe("festival");
  });

  it("round-trips an existing row's values", () => {
    const row = {
      name: "Banda",
      stage: 2,
      date: "2026-07-11",
      show_start: "22:15",
      show_end: "23:30",
      soundcheck_date: "2026-07-10",
      foh_console: "SD12",
      foh_console_provided_by: "band",
      mic_kit: "mixed",
      infra_analog: 8,
      wired_mics: [{ model: "SM58", quantity: 4 }],
    };
    const values = toArtistFormValues(row, { selectedDate: "2026-01-01" });
    expect(values).toMatchObject(row);
  });
});

describe("toArtistCategoryPatch", () => {
  const values = toArtistFormValues({ notes: "", foh_drive: "", infra_analog: 4 });

  it("only writes the fields of the requested category", () => {
    const patch = toArtistCategoryPatch(values, "infrastructure");
    expect(Object.keys(patch).sort()).toEqual([...ARTIST_CATEGORY_FIELDS.infrastructure].sort());
    expect(patch).not.toHaveProperty("name");
  });

  it("stores empty optional text as null", () => {
    expect(toArtistCategoryPatch(values, "notes")).toEqual({ notes: null });
    expect(toArtistCategoryPatch(values, "consoles").foh_drive).toBeNull();
  });
});

describe("artistFormSchema", () => {
  it("requires a trimmed name and a date", () => {
    expect(artistFormSchema.safeParse({ name: "  ", stage: 1, date: "2026-07-10" }).success).toBe(false);
    expect(artistFormSchema.safeParse({ name: "A", stage: 1, date: "" }).success).toBe(false);
    expect(artistFormSchema.safeParse({ name: "A", stage: 1, date: "2026-07-10" }).success).toBe(true);
  });
});
