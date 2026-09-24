// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));

import { useTechAppJobDeepLink } from "@/hooks/useTechAppJobDeepLink";
import { consumeDocumentReturn, rememberDocumentReturn } from "@/lib/techAppReturn";

type Job = { id: string; title: string };
const jobs: Job[] = [{ id: "job-1", title: "Auditorio" }];

function renderAt(url: string, isReady: boolean, onOpenDetails = vi.fn()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  const hook = renderHook(
    (props: { isReady: boolean }) => {
      const link = useTechAppJobDeepLink<Job>({
        isReady: props.isReady,
        resolveJob: (jobId) => jobs.find((job) => job.id === jobId),
        onOpenDetails,
      });
      return { link, location: useLocation() };
    },
    { wrapper, initialProps: { isReady } },
  );
  return { ...hook, onOpenDetails };
}

describe("useTechAppJobDeepLink", () => {
  beforeEach(() => window.localStorage.clear());

  it("puts the technician back on the document's job after the app restarts", () => {
    rememberDocumentReturn({ pathname: "/tech-app", search: "?tab=jobs&open=details&jobId=job-1&detailsTab=Docs" });
    const { result, onOpenDetails } = renderAt("/tech-app", true);
    expect(result.current.location.search).toBe("?tab=jobs&open=details&jobId=job-1&detailsTab=Docs");
    expect(onOpenDetails).toHaveBeenCalledWith(jobs[0]);
    expect(result.current.link.detailsTab).toBe("Docs");
  });

  it("lets an explicit link win over the saved return point", () => {
    rememberDocumentReturn({ pathname: "/tech-app", search: "?open=details&jobId=job-1&detailsTab=Docs" });
    const { result } = renderAt("/tech-app?open=details&jobId=job-1", true);
    expect(result.current.location.search).toBe("?open=details&jobId=job-1");
    expect(consumeDocumentReturn()).toBeNull();
  });

  it("forgets the return point when the job is closed", () => {
    const { result } = renderAt("/tech-app?open=details&jobId=job-1&detailsTab=Docs", true);
    rememberDocumentReturn({ pathname: "/tech-app", search: "?open=details&jobId=job-1&detailsTab=Docs" });
    act(() => result.current.link.forgetOpenDetails());
    expect(consumeDocumentReturn()).toBeNull();
  });

  it("waits for assignments, then reopens the job on the remembered tab", () => {
    const { result, rerender, onOpenDetails } = renderAt(
      "/tech-app?tab=jobs&open=details&jobId=job-1&detailsTab=Docs",
      false,
    );
    expect(onOpenDetails).not.toHaveBeenCalled();

    rerender({ isReady: true });
    expect(onOpenDetails).toHaveBeenCalledWith(jobs[0]);
    expect(result.current.link.detailsTab).toBe("Docs");
    // The params stay while the modal is open, so a reload restores it.
    expect(result.current.location.search).toContain("open=details");
  });

  it("records the open job and tab, and clears them on close", () => {
    const { result, onOpenDetails } = renderAt("/tech-app?tab=jobs", true);

    act(() => result.current.link.rememberOpenDetails("job-1"));
    act(() => result.current.link.rememberDetailsTab("Docs"));
    expect(result.current.location.search).toBe("?tab=jobs&open=details&jobId=job-1&detailsTab=Docs");
    // Opening it ourselves must not trigger a second open from the URL.
    expect(onOpenDetails).not.toHaveBeenCalled();

    act(() => result.current.link.forgetOpenDetails());
    expect(result.current.location.search).toBe("?tab=jobs");
  });

  it("ignores unknown details tabs", () => {
    const { result } = renderAt("/tech-app?open=details&jobId=job-1&detailsTab=bogus", true);
    expect(result.current.link.detailsTab).toBeUndefined();
  });

  it("tells the technician when the job is no longer theirs", () => {
    const { result, onOpenDetails } = renderAt("/tech-app?jobId=job-gone&open=details", true);
    expect(onOpenDetails).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith("Este trabajo ya no figura en tu agenda");
    expect(result.current.location.search).toBe("");
  });

  it("ignores other deep links", () => {
    const { onOpenDetails, result } = renderAt("/tech-app?jobId=job-1&open=artists", true);
    expect(onOpenDetails).not.toHaveBeenCalled();
    expect(result.current.location.search).toBe("?jobId=job-1&open=artists");
  });
});
