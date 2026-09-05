import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { expect, it } from "vitest";
import rule from "./email-template-rule.mjs";
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{ files: ["**/*.ts"], languageOptions: { parser: tseslint.parser }, plugins: { audit: { rules: { html: rule } } }, rules: { "audit/html": "error" } }] });
const header = 'import { escapeHtml } from "../_shared/corporateEmailTemplate.ts";';
async function errors(source: string) { return (await eslint.lintText(header + source, { filePath: "fixture.ts" }))[0].errorCount; }
it("rejects raw data, computed values and misleading safe variable names", async () => {
  expect(await errors('const safeName = profile.first_name; const html = `<p>${safeName}</p>`;')).toBe(1);
  expect(await errors('const html = `<a href="${request.url}">open</a>`;')).toBe(1);
});
it("accepts the real escaping helper and immutable escaped aliases", async () => {
  expect(await errors('const safeName = escapeHtml(profile.first_name); const html = `<p>${safeName}</p>`;')).toBe(0);
  expect(await errors('const html = `<p>${escapeHtml(String(count))}</p>`;')).toBe(0);
});
it("rejects mutable aliases and a shadowed escaping helper", async () => {
  expect(await errors('let safeName = escapeHtml(name); safeName = raw; const html = `<p>${safeName}</p>`;')).toBe(1);
  expect(await errors('function template(escapeHtml) { return `<p>${escapeHtml(raw)}</p>`; }')).toBe(1);
});
it("checks nested HTML and rejects raw data hidden in composition", async () => {
  expect(await errors('const part = `<b>${escapeHtml(name)}</b>`; const html = `<p>${enabled ? part : ""}</p>`;')).toBe(0);
  expect(await errors('const part = `<b>${raw}</b>`; const html = `<p>${part}</p>`;')).toBe(2);
});
it("allows escaped multiline messages and mapped markup without trusting arbitrary calls", async () => {
  expect(await errors('const safe = escapeHtml(raw).replace(/\\n/g, "<br/>"); const html = `<p>${safe}</p>`;')).toBe(0);
  expect(await errors('const rows = items.map(item => `<li>${escapeHtml(item.name)}</li>`).join(""); const html = `<ul>${rows}</ul>`;')).toBe(0);
  expect(await errors('const html = `<p>${sanitizeButNotReviewed(raw)}</p>`;')).toBe(1);
});
