import { describe, expect, it } from "vitest";

import {
  buildWahaGroupParticipants,
  phoneToWahaJid,
} from "../recipientUtils.ts";

describe("WAHA participant helpers", () => {
  it("converts phone numbers to WAHA JIDs", () => {
    expect(phoneToWahaJid("+34 611 111 111")).toBe("34611111111@c.us");
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
