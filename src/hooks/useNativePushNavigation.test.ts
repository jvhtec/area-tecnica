import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: {} }));
vi.mock("@/lib/push-native", () => ({ isNativePushSupported: () => false }));

import { getNativeNotificationPath } from "./useNativePushNavigation";

describe("getNativeNotificationPath", () => {
  it("extracts safe APNs data destinations", () => {
    expect(getNativeNotificationPath({
      actionId: "tap",
      inputValue: "",
      notification: { id: "1", data: { url: "/tour-management/tour-1" } },
    })).toBe("/tour-management/tour-1");
  });

  it("rejects external destinations", () => {
    expect(getNativeNotificationPath({
      actionId: "tap",
      inputValue: "",
      notification: { id: "1", data: { url: "https://outside.invalid" } },
    })).toBeNull();
  });
});
