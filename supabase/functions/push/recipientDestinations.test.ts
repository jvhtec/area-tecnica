import { describe, expect, it } from "vitest";

import { canRoleOpenDestination, destinationForRole } from "./recipientDestinations.ts";

const JOB = "7d0c5c3e-2f4f-4c2c-9d52-2b8b8a9f0e11";

describe("destinationForRole", () => {
  it("keeps the shared URL for roles that can open it", () => {
    const url = `/festival-management/${JOB}?singleJob=true`;
    expect(destinationForRole(url, "management", { jobId: JOB })).toBe(url);
    expect(destinationForRole(url, "house_tech", { jobId: JOB })).toBe(url);
    expect(destinationForRole("/timesheets", "technician")).toBe("/timesheets");
  });

  it("sends freelancers to the job inside the tech app", () => {
    expect(destinationForRole(`/festival-management/${JOB}?singleJob=true`, "technician", { jobId: JOB }))
      .toBe(`/tech-app?tab=jobs&jobId=${JOB}&open=details`);
    // Management-only destinations for a job-scoped event still resolve to the job.
    expect(destinationForRole("/job-assignment-matrix", "technician", { jobId: JOB }))
      .toBe(`/tech-app?tab=jobs&jobId=${JOB}&open=details`);
  });

  it("keeps the artist view and its date for festival crew", () => {
    expect(destinationForRole(`/festival-management/${JOB}/artists?date=2026-09-24`, "technician"))
      .toBe(`/tech-app?tab=jobs&jobId=${JOB}&open=artists&date=2026-09-24`);
  });

  it("falls back to a home each role can open", () => {
    expect(destinationForRole("/announcements", "technician")).toBe("/tech-app");
    expect(destinationForRole("/announcements", "management")).toBe("/dashboard");
    expect(destinationForRole("/announcements", "house_tech")).toBe("/technician-dashboard");
    expect(destinationForRole("/personal", "technician")).toBe("/tech-app?tab=availability");
  });

  it("uses the job page for non-freelance roles when it is reachable", () => {
    const jobUrl = `/festival-management/${JOB}?singleJob=true`;
    expect(destinationForRole("/job-assignment-matrix", "house_tech", { jobId: JOB, jobUrl })).toBe(jobUrl);
    // logistics cannot open festival management either, so it goes home.
    expect(destinationForRole("/job-assignment-matrix", "logistics", { jobId: JOB, jobUrl })).toBe("/dashboard");
  });

  it("leaves unknown destinations untouched", () => {
    expect(canRoleOpenDestination("/some-future-page", "technician")).toBe(true);
    expect(destinationForRole("/some-future-page", "technician")).toBe("/some-future-page");
  });
});
