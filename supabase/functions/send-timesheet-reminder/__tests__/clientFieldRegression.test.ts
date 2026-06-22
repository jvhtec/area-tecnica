import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const functionSource = readFileSync(resolve(__dirname, "../index.ts"), "utf8");

describe("send-timesheet-reminder client field regression", () => {
  it("does not query or render removed job client fields", () => {
    expect(functionSource).not.toContain("client_name");
    expect(functionSource).not.toContain("client_phone");
    expect(functionSource).not.toContain("<strong>Cliente:</strong>");
  });
});
