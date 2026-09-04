// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TodaySchedule, type TodayScheduleEntry } from "@/components/dashboard/TodaySchedule";
import type { JobCardJob } from "@/features/jobs/job-card-new/jobCardNewTypes";

vi.mock("@/components/jobs/cards/JobCardNew", () => ({
  JobCardNew: ({ job, department }: { job: JobCardJob; department: string }) => (
    <div data-testid={`job-card-${job.id}`} data-department={department}>
      {job.title}
    </div>
  ),
}));

const job: JobCardJob = {
  id: "job-1",
  title: "Festival setup",
  start_time: "2026-09-04T08:00:00.000Z",
  end_time: "2026-09-04T18:00:00.000Z",
  created_at: "2026-09-01T10:00:00.000Z",
  job_type: "festival",
};

const commonProps = {
  onEditClick: vi.fn(),
  onDeleteClick: vi.fn(),
  onJobClick: vi.fn(),
  userRole: "admin",
} as const;

describe("TodaySchedule", () => {
  it.each([
    ["a direct job row", job],
    [
      "an assignment row with an embedded job",
      { job_id: job.id, department: "lights", jobs: job } satisfies TodayScheduleEntry,
    ],
  ])("renders %s without filtering it at runtime", (_label, entry) => {
    render(<TodaySchedule {...commonProps} jobs={[entry]} viewMode="sidebar" />);

    expect(screen.getByTestId("job-card-job-1")).toHaveTextContent("Festival setup");
  });

  it("uses the wrapper department for embedded job rows", () => {
    const entry = { job_id: job.id, department: "video", jobs: job } satisfies TodayScheduleEntry;

    render(<TodaySchedule {...commonProps} jobs={[entry]} viewMode="sidebar" />);

    expect(screen.getByTestId("job-card-job-1")).toHaveAttribute("data-department", "video");
  });
});
