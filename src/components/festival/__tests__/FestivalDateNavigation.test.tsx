// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";

vi.mock("@/components/dashboard/DateTypeContextMenu", () => ({
  DateTypeContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("FestivalDateNavigation", () => {
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
});
