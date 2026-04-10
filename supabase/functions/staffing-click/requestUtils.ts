export type StaffingClickAction = "confirm" | "decline";
export type StaffingClickUrlStyle = "legacy" | "path" | "invalid";

export interface ParsedStaffingClickRequest {
  action: StaffingClickAction | null;
  rid: string | null;
  token: string | null;
  exp: string | null;
  channelHint: string;
  urlStyle: StaffingClickUrlStyle;
}

function isStaffingClickAction(value: string | null | undefined): value is StaffingClickAction {
  return value === "confirm" || value === "decline";
}

export function parseStaffingClickRequest(input: URL | string): ParsedStaffingClickRequest {
  const url = typeof input === "string" ? new URL(input) : input;
  const channelHint = (url.searchParams.get("c") || "").toLowerCase();
  const queryRid = url.searchParams.get("rid");
  const queryAction = url.searchParams.get("a");
  const queryExp = url.searchParams.get("exp");
  const queryToken = url.searchParams.get("t");

  if (queryRid || queryAction || queryExp || queryToken) {
    return {
      action: isStaffingClickAction(queryAction) ? queryAction : null,
      rid: queryRid,
      token: queryToken,
      exp: queryExp,
      channelHint,
      urlStyle: "legacy",
    };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const markerIndex = segments.lastIndexOf("staffing-click");
  if (markerIndex === -1) {
    return {
      action: null,
      rid: null,
      token: null,
      exp: null,
      channelHint,
      urlStyle: "invalid",
    };
  }

  const [pathAction, rid, token] = segments.slice(markerIndex + 1, markerIndex + 4);
  return {
    action: isStaffingClickAction(pathAction) ? pathAction : null,
    rid: rid || null,
    token: token || null,
    exp: null,
    channelHint,
    urlStyle: "path",
  };
}
