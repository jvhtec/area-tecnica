import { describe, expect, it } from "vitest";

import {
  computeRequestWindow,
  detectConflictForAssignment,
  windowsIntersect,
  type AssignmentCoverage,
  type JobTimeInfo,
} from "../conflictUtils.ts";
import {
  buildStaffingClickWhatsappFollowupMessage,
  shouldSendStaffingClickWhatsappFollowup,
} from "../followupUtils.ts";
import { parseStaffingClickRequest } from "../requestUtils.ts";

const makeJob = (
  start = "2026-10-10T08:00:00.000Z",
  end = "2026-10-10T20:00:00.000Z",
): JobTimeInfo => ({
  title: "Target",
  start: new Date(start),
  end: new Date(end),
  rawStart: start,
  rawEnd: end,
});

const makeCoverage = (
  start: string,
  end: string,
  jobId = 99,
  title = "Existing",
): AssignmentCoverage => ({
  window: { kind: "range", start: new Date(start), end: new Date(end) },
  meta: {
    job_id: jobId,
    job_title: title,
    start_time: start,
    end_time: end,
  },
});

describe("staffing-click Phase 1 edge characterization", () => {
  describe("window intersection semantics", () => {
    it("detects a proper overlap", () => {
      expect(
        windowsIntersect(
          { kind: "range", start: new Date("2026-10-10T08:00:00Z"), end: new Date("2026-10-10T12:00:00Z") },
          { kind: "range", start: new Date("2026-10-10T11:00:00Z"), end: new Date("2026-10-10T14:00:00Z") },
        ),
      ).toBe(true);
    });

    it("does not treat touching boundaries as an overlap", () => {
      expect(
        windowsIntersect(
          { kind: "range", start: new Date("2026-10-10T08:00:00Z"), end: new Date("2026-10-10T12:00:00Z") },
          { kind: "range", start: new Date("2026-10-10T12:00:00Z"), end: new Date("2026-10-10T14:00:00Z") },
        ),
      ).toBe(false);
    });

    it("detects containment in either direction", () => {
      const outer = { kind: "range" as const, start: new Date("2026-10-10T08:00:00Z"), end: new Date("2026-10-10T20:00:00Z") };
      const inner = { kind: "range" as const, start: new Date("2026-10-10T10:00:00Z"), end: new Date("2026-10-10T11:00:00Z") };
      expect(windowsIntersect(outer, inner)).toBe(true);
      expect(windowsIntersect(inner, outer)).toBe(true);
    });
  });

  describe("request-window construction", () => {
    it("uses a 24-hour UTC window for a target date", () => {
      const window = computeRequestWindow("2026-10-10", makeJob());
      expect(window?.kind).toBe("day");
      expect(window?.start.toISOString()).toBe("2026-10-10T00:00:00.000Z");
      expect(window?.end.toISOString()).toBe("2026-10-11T00:00:00.000Z");
    });

    it("returns null for an invalid target date", () => {
      expect(computeRequestWindow("definitely-not-a-date", makeJob())).toBeNull();
    });

    it("uses the full job range when there is no target date", () => {
      const job = makeJob();
      expect(computeRequestWindow(null, job)).toEqual({
        kind: "range",
        start: job.start,
        end: job.end,
      });
    });

    it("returns null when full-span job timing is incomplete", () => {
      expect(
        computeRequestWindow(null, {
          title: "Broken",
          start: null,
          end: new Date("2026-10-10T20:00:00Z"),
          rawStart: null,
          rawEnd: "2026-10-10T20:00:00Z",
        }),
      ).toBeNull();
    });

    it("returns null for a zero-length or inverted job range", () => {
      expect(
        computeRequestWindow(
          null,
          makeJob("2026-10-10T20:00:00Z", "2026-10-10T20:00:00Z"),
        ),
      ).toBeNull();
      expect(
        computeRequestWindow(
          null,
          makeJob("2026-10-10T21:00:00Z", "2026-10-10T20:00:00Z"),
        ),
      ).toBeNull();
    });
  });

  describe("assignment conflict characterization", () => {
    it("returns no conflict when there are no existing assignment windows", () => {
      expect(
        detectConflictForAssignment({
          targetDate: null,
          existingAssignmentWindows: [],
          jobInfo: makeJob(),
          jobId: 1,
          jobStartTime: "2026-10-10T08:00:00Z",
          jobEndTime: "2026-10-10T20:00:00Z",
        }),
      ).toEqual({ conflict: false });
    });

    it("returns no conflict when the request window cannot be constructed", () => {
      expect(
        detectConflictForAssignment({
          targetDate: "bad-date",
          existingAssignmentWindows: [
            makeCoverage("2026-10-10T09:00:00Z", "2026-10-10T10:00:00Z"),
          ],
          jobInfo: makeJob(),
          jobId: 1,
          jobStartTime: null,
          jobEndTime: null,
        }),
      ).toEqual({ conflict: false });
    });

    it("does not conflict with an adjacent existing range", () => {
      expect(
        detectConflictForAssignment({
          targetDate: null,
          existingAssignmentWindows: [
            makeCoverage("2026-10-10T20:00:00Z", "2026-10-10T22:00:00Z"),
          ],
          jobInfo: makeJob(),
          jobId: 1,
          jobStartTime: "2026-10-10T08:00:00Z",
          jobEndTime: "2026-10-10T20:00:00Z",
        }),
      ).toEqual({ conflict: false });
    });

    it("reports full-span conflict metadata", () => {
      const result = detectConflictForAssignment({
        targetDate: null,
        existingAssignmentWindows: [
          makeCoverage("2026-10-10T19:00:00Z", "2026-10-10T22:00:00Z", 88, "Late Show"),
        ],
        jobInfo: makeJob(),
        jobId: 1,
        jobStartTime: "2026-10-10T08:00:00Z",
        jobEndTime: "2026-10-10T20:00:00Z",
      });

      expect(result).toEqual({
        conflict: true,
        meta: {
          request_job_id: 1,
          request_single_day: false,
          request_window_type: "range",
          request_job_start: "2026-10-10T08:00:00Z",
          request_job_end: "2026-10-10T20:00:00Z",
          conflicting_job_id: 88,
          conflicting_job_title: "Late Show",
          conflicting_window_type: "range",
          conflicting_job_start: "2026-10-10T19:00:00Z",
          conflicting_job_end: "2026-10-10T22:00:00Z",
        },
      });
    });

    it("reports the first overlapping assignment when more than one overlaps", () => {
      const result = detectConflictForAssignment({
        targetDate: null,
        existingAssignmentWindows: [
          makeCoverage("2026-10-10T09:00:00Z", "2026-10-10T10:00:00Z", 11, "First"),
          makeCoverage("2026-10-10T11:00:00Z", "2026-10-10T12:00:00Z", 12, "Second"),
        ],
        jobInfo: makeJob(),
        jobId: 1,
        jobStartTime: "2026-10-10T08:00:00Z",
        jobEndTime: "2026-10-10T20:00:00Z",
      });

      expect(result.conflict).toBe(true);
      if (result.conflict) {
        expect(result.meta.conflicting_job_id).toBe(11);
      }
    });
  });

  describe("signed-link request parsing", () => {
    it("rejects an incomplete path link", () => {
      expect(
        parseStaffingClickRequest(
          "https://project.functions.supabase.co/staffing-click/confirm/request-only",
        ),
      ).toMatchObject({
        action: null,
        rid: null,
        token: null,
        urlStyle: "invalid",
      });
    });

    it("rejects an unsupported action", () => {
      expect(
        parseStaffingClickRequest(
          "https://project.functions.supabase.co/staffing-click/maybe/request-1/token-1",
        ),
      ).toMatchObject({
        action: null,
        urlStyle: "invalid",
      });
    });

    it("prefers legacy query parsing when any legacy query field is present", () => {
      const parsed = parseStaffingClickRequest(
        "https://project.functions.supabase.co/staffing-click/confirm/path-request/path-token?rid=query-request&a=decline&t=query-token",
      );
      expect(parsed).toMatchObject({
        action: "decline",
        rid: "query-request",
        token: "query-token",
        urlStyle: "legacy",
      });
    });

    it("normalizes the channel hint to lowercase", () => {
      expect(
        parseStaffingClickRequest(
          "https://project.functions.supabase.co/staffing-click?rid=r&a=confirm&t=t&c=WHATSAPP",
        ).channelHint,
      ).toBe("whatsapp");
    });

    it("returns a legacy shape with null action instead of falling through to the path", () => {
      const parsed = parseStaffingClickRequest(
        "https://project.functions.supabase.co/staffing-click/confirm/path-request/path-token?a=invalid",
      );
      expect(parsed).toMatchObject({
        action: null,
        urlStyle: "legacy",
      });
    });

    it("parses a path even when staffing-click is nested below a prefix", () => {
      expect(
        parseStaffingClickRequest(
          "https://example.test/functions/v1/staffing-click/confirm/request-1/token-1",
        ),
      ).toMatchObject({
        action: "confirm",
        rid: "request-1",
        token: "token-1",
        urlStyle: "path",
      });
    });
  });

  describe("WhatsApp follow-up decision", () => {
    it("sends a follow-up when the original channel hint is WhatsApp", () => {
      expect(shouldSendStaffingClickWhatsappFollowup("whatsapp", null)).toBe(true);
    });

    it("sends a follow-up when a WhatsApp send event exists even without the hint", () => {
      expect(
        shouldSendStaffingClickWhatsappFollowup("", { event: "whatsapp_sent" }),
      ).toBe(true);
    });

    it("does not infer WhatsApp from arbitrary nonempty channel text", () => {
      expect(shouldSendStaffingClickWhatsappFollowup("email", null)).toBe(false);
      expect(shouldSendStaffingClickWhatsappFollowup("WHATSAPP", null)).toBe(false);
    });

    it("keeps phase-specific confirmation copy distinct", () => {
      expect(
        buildStaffingClickWhatsappFollowupMessage("availability", "confirmed"),
      ).not.toBe(
        buildStaffingClickWhatsappFollowupMessage("offer", "confirmed"),
      );
    });
  });
});
