// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));

import { useTechAppJobDeepLink } from "@/hooks/useTechAppJobDeepLink";

type Job = { id: string; title: string };
const jobs: Job[] = [{ id: "job-1", title: "Auditorio" }];

function renderAt(url: string, isReady: boolean, onOpenDetails = vi.fn()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  const hook = renderHook(
    (props: { isReady: boolean }) => {
      useTechAppJobDeepLink<Job>({
        isReady: props.isReady,
        resolveJob: (jobId) => jobs.find((job) => job.id === jobId),
        onOpenDetails,
      });
      return useLocation();
    },
    { wrapper, initialProps: { isReady } },
  );
  return { ...hook, onOpenDetails };
}

describe("useTechAppJobDeepLink", () => {
  it("waits for assignments, then opens the job and clears the params", () => {
    const { result, rerender, onOpenDetails } = renderAt("/tech-app?tab=jobs&jobId=job-1&open=details", false);
    expect(onOpenDetails).not.toHaveBeenCalled();

    rerender({ isReady: true });
    expect(onOpenDetails).toHaveBeenCalledWith(jobs[0]);
    expect(result.current.search).toBe("?tab=jobs");
  });

  it("tells the technician when the job is no longer theirs", () => {
    const { onOpenDetails } = renderAt("/tech-app?jobId=job-gone&open=details", true);
    expect(onOpenDetails).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith("Este trabajo ya no figura en tu agenda");
  });

  it("ignores other deep links", () => {
    const { onOpenDetails, result } = renderAt("/tech-app?jobId=job-1&open=artists", true);
    expect(onOpenDetails).not.toHaveBeenCalled();
    expect(result.current.search).toBe("?jobId=job-1&open=artists");
  });
});
