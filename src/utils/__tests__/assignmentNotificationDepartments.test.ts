import { describe, expect, it } from "vitest";

import { getAssignmentNotificationDepartments } from "../assignmentNotificationDepartments";

describe("getAssignmentNotificationDepartments", () => {
  it("derives departments from active assignment role columns", () => {
    expect(getAssignmentNotificationDepartments({
      sound_role: "foh",
      lights_role: "none",
      video_role: null,
      production_role: "pm",
    })).toEqual(["sound", "production"]);
  });

  it("falls back to explicit or technician department when role columns are unavailable", () => {
    expect(getAssignmentNotificationDepartments({ department: " lights " }, "sound")).toEqual(["lights"]);
    expect(getAssignmentNotificationDepartments({}, "sound")).toEqual(["sound"]);
  });
});
