// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";

vi.mock("@/components/dashboard/DateTypeContextMenu", () => ({
  DateTypeContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("FestivalDateNavigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps unconfigured festival dates visible as default show dates", () => {
    render(
      <FestivalDateNavigation
        jobDates={[
          new Date("2026-06-03T22:00:00.000Z"),
          new Date("2026-06-04T22:00:00.000Z"),
          new Date("2026-06-05T22:00:00.000Z"),
        ]}
        selectedDate="2026-06-04"
        onDateChange={vi.fn()}
        dateTypes={{
          "job-1-2026-06-04": "setup",
        }}
        jobId="job-1"
        onTypeChange={vi.fn()}
        dayStartTime="07:00"
      />,
    );

    expect(screen.getByText("jue, 4 jun")).toBeInTheDocument();
    expect(screen.getByText("vie, 5 jun")).toBeInTheDocument();
    expect(screen.getByText("sáb, 6 jun")).toBeInTheDocument();
  });

  it("makes the selected date explicit in both the summary and active tab", () => {
    render(
      <FestivalDateNavigation
        jobDates={[
          new Date("2026-08-03T22:00:00.000Z"),
          new Date("2026-08-04T22:00:00.000Z"),
          new Date("2026-08-05T22:00:00.000Z"),
        ]}
        selectedDate="2026-08-05"
        onDateChange={vi.fn()}
        dateTypes={{}}
        jobId="job-1"
        onTypeChange={vi.fn()}
        dayStartTime="07:00"
      />,
    );

    expect(screen.getByText("Fecha seleccionada:")).toBeInTheDocument();
    expect(screen.getByText("miércoles, 5 de agosto de 2026")).toBeInTheDocument();
    const selectedTab = screen.getByRole("tab", { name: "mié, 5 ago" });
    expect(selectedTab).toHaveAttribute("aria-current", "date");
    expect(selectedTab).toHaveClass(
      "!bg-primary",
      "!text-primary-foreground",
      "font-semibold",
    );
  });

  it("uses the Madrid day boundary when hiding and revealing past dates", () => {
    vi.setSystemTime(new Date("2026-08-02T22:30:00.000Z"));

    render(
      <FestivalDateNavigation
        jobDates={[
          new Date("2026-08-01T22:00:00.000Z"),
          new Date("2026-08-02T22:00:00.000Z"),
          new Date("2026-08-03T22:00:00.000Z"),
        ]}
        selectedDate="2026-08-04"
        onDateChange={vi.fn()}
        dateTypes={{}}
        jobId="job-1"
        onTypeChange={vi.fn()}
        dayStartTime="07:00"
      />,
    );

    expect(screen.queryByRole("tab", { name: "dom, 2 ago" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "lun, 3 ago" })).toBeInTheDocument();

    const showPastDates = screen.getByRole("switch", {
      name: "Mostrar fechas pasadas",
    });
    expect(showPastDates).not.toBeChecked();

    fireEvent.click(showPastDates);

    expect(showPastDates).toBeChecked();
    expect(screen.getByRole("tab", { name: "dom, 2 ago" })).toBeInTheDocument();
  });
});
