import { describe, expect, it } from "vitest";

import { handleImageProxyRequest } from "./handler";

describe("retired image proxy", () => {
  it("fails closed without fetching caller-controlled URLs", async () => {
    const response = handleImageProxyRequest();

    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Image proxy retired",
      code: "image_proxy_retired",
    });
  });
});

