import { describe, expect, it } from "vitest";

import { extractFunctionErrorMessage } from "../supabaseFunctionError";

describe("extractFunctionErrorMessage", () => {
  it("includes Edge Function body details, status, and request id", async () => {
    const error = {
      message: "FunctionsHttpError",
      context: new Response(JSON.stringify({
        error: "WAHA group creation failed",
        request_id: "request-1",
        response: "Session disconnected",
        status: 500,
      })),
    };

    await expect(extractFunctionErrorMessage(error)).resolves.toBe(
      "WAHA group creation failed (500) [request-1]: Session disconnected",
    );
  });

  it("falls back to the top-level error message when the body cannot be parsed", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response("not-json"),
    };

    await expect(extractFunctionErrorMessage(error)).resolves.toBe(
      "Edge Function returned a non-2xx status code",
    );
  });
});
