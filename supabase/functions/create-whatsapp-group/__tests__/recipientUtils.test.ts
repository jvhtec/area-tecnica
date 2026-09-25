import { describe, expect, it } from "vitest";

import {
  buildWahaGroupParticipants,
  collectFestivalStageRecipients,
  normalizePhone,
  phoneToWahaJid,
  resolveBuddyIds,
} from "../recipientUtils.ts";

describe("WAHA participant helpers", () => {
  it("converts phone numbers to WAHA JIDs", () => {
    expect(phoneToWahaJid("+34 611 111 111")).toBe("34611111111@c.us");
  });

  it("normalizes Spanish shorthand and international WhatsApp numbers", () => {
    expect(normalizePhone("611 111 111", "+34")).toEqual({ ok: true, value: "+34611111111" });
    expect(normalizePhone("34611111111", "+34")).toEqual({ ok: true, value: "+34611111111" });
    expect(normalizePhone("+351 912 345 678", "+34")).toEqual({ ok: true, value: "+351912345678" });
    expect(normalizePhone("00351 912 345 678", "+34")).toEqual({ ok: true, value: "+351912345678" });
    expect(normalizePhone("351912345678", "+34")).toEqual({ ok: true, value: "+351912345678" });
  });

  it("rejects ambiguous non-Spanish local numbers without a country code", () => {
    expect(normalizePhone("912 345 678", "+34")).toEqual({ ok: false, reason: "missing_country_code" });
  });

  it("excludes the actor/session JID from WAHA group creation participants", () => {
    const actorJid = phoneToWahaJid("+34611111111");

    expect(
      buildWahaGroupParticipants({
        actorJid,
        participants: ["+34611111111", "+34622222222", "+34633333333"],
      }),
    ).toEqual({
      allParticipants: [{ id: actorJid }, { id: "34622222222@c.us" }, { id: "34633333333@c.us" }],
      groupParticipants: [{ id: "34622222222@c.us" }, { id: "34633333333@c.us" }],
    });
  });
});

describe("festival stage recipient helpers", () => {
  it("collects scheduled technicians from matching stage department shifts", () => {
    expect(
      collectFestivalStageRecipients({
        department: "sound",
        shifts: [
          { id: "shift-sound", department: "sound" },
          { id: "shift-lights", department: "lights" },
        ],
        assignments: [
          {
            external_technician_name: null,
            role: "SND-FOH-R",
            shift_id: "shift-sound",
            technician_id: "tech-1",
          },
          {
            external_technician_name: null,
            role: "LGT-BRD-R",
            shift_id: "shift-lights",
            technician_id: "tech-2",
          },
          {
            external_technician_name: "External Sound",
            role: "SND-PA-T",
            shift_id: "shift-sound",
            technician_id: null,
          },
        ],
      }),
    ).toEqual({
      assignmentCount: 3,
      externalNames: ["External Sound"],
      shiftCount: 2,
      technicianIds: ["tech-1"],
    });
  });

  it("uses role prefixes for stage shifts without a department", () => {
    expect(
      collectFestivalStageRecipients({
        department: "video",
        shifts: [{ id: "shift-open", department: null }],
        assignments: [
          {
            external_technician_name: null,
            role: "VID-CAM-E",
            shift_id: "shift-open",
            technician_id: "video-tech",
          },
          {
            external_technician_name: null,
            role: "SND-FOH-R",
            shift_id: "shift-open",
            technician_id: "sound-tech",
          },
        ],
      }),
    ).toEqual({
      assignmentCount: 2,
      externalNames: [],
      shiftCount: 1,
      technicianIds: ["video-tech"],
    });
  });
});

describe("department buddies", () => {
  const JAVIER = "3f320605-c05c-4dcc-b668-c0e01e2c4af9";
  const BASTIAN = "d51f69e1-ab53-44b3-aec7-871a10c6d6dd";
  const CARLOS = "4d1b7ec6-0657-496e-a759-c721916e0c09";

  it("pairs Javier and Bastián on sound groups", () => {
    expect(resolveBuddyIds("sound", BASTIAN)).toEqual([JAVIER]);
    expect(resolveBuddyIds("sound", JAVIER)).toEqual([BASTIAN]);
  });

  it("adds nobody for former or other managers, other departments or unknown actors", () => {
    expect(resolveBuddyIds("sound", CARLOS)).toEqual([]);
    expect(resolveBuddyIds("sound", "someone-else")).toEqual([]);
    expect(resolveBuddyIds("lights", BASTIAN)).toEqual([]);
    expect(resolveBuddyIds("sound", null)).toEqual([]);
  });
});
