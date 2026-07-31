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
    vi.setSystemTime(new Date(2026, 4, 1, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps unconfigured festival dates visible as default show dates", () => {
    render(
      <FestivalDateNavigation
        jobDates={[
          new Date(2026, 5, 4),
          new Date(2026, 5, 5),
          new Date(2026, 5, 6),
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

    expect(screen.getByText("Thu, Jun 4")).toBeInTheDocument();
    expect(screen.getByText("Fri, Jun 5")).toBeInTheDocument();
    expect(screen.getByText("Sat, Jun 6")).toBeInTheDocument();
  });

  it("makes the selected date explicit in both the summary and active tab", () => {
    render(
      <FestivalDateNavigation
        jobDates={[
          new Date(2026, 7, 4),
          new Date(2026, 7, 5),
          new Date(2026, 7, 6),
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
    const selectedTab = screen.getByRole("tab", { name: "Wed, Aug 5" });
    expect(selectedTab).toHaveAttribute("aria-current", "date");
    expect(selectedTab).toHaveClass(
      "!bg-primary",
      "!text-primary-foreground",
      "font-semibold",
    );
  });

  it("hides past dates by default and reveals them on request", () => {
    vi.setSystemTime(new Date(2026, 7, 3, 12));

    render(
      <FestivalDateNavigation
        jobDates={[
          new Date(2026, 7, 1),
          new Date(2026, 7, 3),
          new Date(2026, 7, 4),
        ]}
        selectedDate="2026-08-04"
        onDateChange={vi.fn()}
        dateTypes={{}}
        jobId="job-1"
        onTypeChange={vi.fn()}
        dayStartTime="07:00"
      />,
    );

    expect(screen.queryByRole("tab", { name: "Sat, Aug 1" })).not.toBeInTheDocument();

    const showPastDates = screen.getByRole("switch", {
      name: "Mostrar fechas pasadas",
    });
    expect(showPastDates).not.toBeChecked();

    fireEvent.click(showPastDates);

    expect(showPastDates).toBeChecked();
    expect(screen.getByRole("tab", { name: "Sat, Aug 1" })).toBeInTheDocument();
  });
});
