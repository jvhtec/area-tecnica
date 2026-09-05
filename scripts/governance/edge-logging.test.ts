import { ESLint } from "eslint";
import { expect, it } from "vitest";

const eslint = new ESLint();
it("rejects bare console in new functions and migrated auth/mail boundaries", async () => {
  for (const filePath of ["supabase/functions/new-audited-handler/index.ts", "supabase/functions/_shared/auth.ts", "supabase/functions/send-staffing-email/index.ts"]) {
    const [result] = await eslint.lintText('console.error("raw", request.body);', { filePath });
    expect(result.messages.some(message => message.ruleId === "no-console")).toBe(true);
  }
});
it("allows the single structured logger transport", async () => {
  const [result] = await eslint.lintText('console[level](record);', { filePath: "supabase/functions/_shared/structuredLogger.ts" });
  expect(result.messages.some(message => message.ruleId === "no-console")).toBe(false);
});
