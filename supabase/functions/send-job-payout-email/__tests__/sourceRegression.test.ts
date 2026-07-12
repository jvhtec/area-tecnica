import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const functionSource = readFileSync(resolve(__dirname, "../index.ts"), "utf8");

describe("send-job-payout-email source regressions", () => {
  it("does not reintroduce removed job client fields", () => {
    expect(functionSource).not.toContain("client_name");
    expect(functionSource).not.toContain("client_phone");
  });

  it("declares the debug flag used by the send path", () => {
    expect(functionSource).toContain(
      'const DEBUG = Deno.env.get("DEBUG_PAYOUT_EMAILS") === "true";',
    );
  });
});
