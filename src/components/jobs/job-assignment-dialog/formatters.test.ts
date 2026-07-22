import { describe, expect, it, vi } from "vitest";

import {
  formatAssignmentTechnicianName,
  formatDepartmentName,
  formatJobDateLabel,
} from "@/components/jobs/job-assignment-dialog/formatters";

describe("job assignment dialog formatters", () => {
  it("formats complete, missing, and blank technician profiles", () => {
    expect(
      formatAssignmentTechnicianName({
        profiles: {
          first_name: "Ana",
          last_name: "López",
          email: null,
          department: "sound",
        },
      }),
    ).toBe("Ana López");
    expect(formatAssignmentTechnicianName({ profiles: null })).toBe("Unknown Technician");
    expect(
      formatAssignmentTechnicianName({
        profiles: {
          first_name: null,
          last_name: null,
          email: null,
          department: null,
        },
      }),
    ).toBe("Unnamed Technician");
  });

  it("formats Madrid calendar dates without shifting timestamp inputs", () => {
    expect(formatJobDateLabel("2026-03-10")).toContain("10 de marzo de 2026");
    expect(formatJobDateLabel("2026-03-09T23:30:00.000Z")).toContain("10 de marzo de 2026");
    expect(formatJobDateLabel(null)).toBe("");
  });

  it("falls back to the source value when a date cannot be formatted", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(formatJobDateLabel("not-a-date")).toBe("not-a-date");
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
  });

  it("uses Spanish department labels and preserves unknown departments", () => {
    expect(formatDepartmentName("SOUND")).toBe("Sonido");
    expect(formatDepartmentName("lights")).toBe("Luces");
    expect(formatDepartmentName("video")).toBe("Video");
    expect(formatDepartmentName("production")).toBe("production");
  });
});
