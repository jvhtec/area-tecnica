import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { flexApiFetch } from "./flex-api-client";

describe("flexApiFetch timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("bounds stalled POST header updates", async () => {
    invokeMock.mockReturnValue(new Promise(() => undefined));

    const request = flexApiFetch("/element/element-1/header-update", {
      method: "POST",
      body: JSON.stringify({ fieldType: "name", payloadValue: "Updated" }),
    });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(20_000);
    await rejection;
  });
});
