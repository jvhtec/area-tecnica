import { describe, expect, it } from "vitest";

import { parseStaffingClickRequest } from "../requestUtils.ts";

describe("parseStaffingClickRequest", () => {
  it("parses the legacy query-string link format", () => {
    const parsed = parseStaffingClickRequest(
      "https://project.functions.supabase.co/staffing-click?rid=request-1&a=confirm&exp=2026-04-12T08%3A58%3A46.807Z&t=token-1&c=whatsapp",
    );

    expect(parsed).toEqual({
      action: "confirm",
      rid: "request-1",
      token: "token-1",
      exp: "2026-04-12T08:58:46.807Z",
      channelHint: "whatsapp",
      urlStyle: "legacy",
    });
  });

  it("parses the branded path-based link format", () => {
    const parsed = parseStaffingClickRequest(
      "https://project.functions.supabase.co/staffing-click/decline/request-2/token-2",
    );

    expect(parsed).toEqual({
      action: "decline",
      rid: "request-2",
      token: "token-2",
      exp: null,
      channelHint: "",
      urlStyle: "path",
    });
  });

  it("parses the stripped runtime path format used by the edge handler", () => {
    const parsed = parseStaffingClickRequest(
      "https://project.functions.supabase.co/confirm/request-3/token-3",
    );

    expect(parsed).toEqual({
      action: "confirm",
      rid: "request-3",
      token: "token-3",
      exp: null,
      channelHint: "",
      urlStyle: "path",
    });
  });
});
