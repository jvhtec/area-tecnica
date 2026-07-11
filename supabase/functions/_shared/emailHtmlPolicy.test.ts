import sanitizeHtml from "sanitize-html";
import { describe, expect, it } from "vitest";

import { sanitizeCorporateEmailHtml } from "./emailHtmlPolicy";

const approvedPrefix = "https://project.supabase.co/storage/v1/object/public/corporate-emails-temp/";

describe("sanitizeCorporateEmailHtml", () => {
  it("removes scripts, event handlers, forms, styles, and dangerous URLs", () => {
    const result = sanitizeCorporateEmailHtml(`
      <script>alert(1)</script>
      <form action="https://attacker.example"><input name="secret"></form>
      <p style="background:url(javascript:alert(1))" onclick="steal()">Hello</p>
      <a href="javascript:alert(1)">bad link</a>
    `, sanitizeHtml, approvedPrefix);

    expect(result).not.toMatch(/script|form|input|style=|onclick|javascript:/i);
    expect(result).toContain("<p>Hello</p>");
  });

  it("keeps safe formatting and hardens links", () => {
    const result = sanitizeCorporateEmailHtml(
      '<p><strong>Hello</strong> <a href="https://sector-pro.work">site</a></p>',
      sanitizeHtml,
      approvedPrefix,
    );

    expect(result).toContain("<strong>Hello</strong>");
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("allows only approved temporary inline-image URLs", () => {
    const result = sanitizeCorporateEmailHtml(`
      <img src="https://tracker.example/pixel.gif" alt="tracker">
      <img src="${approvedPrefix}temp/image.png" alt="approved">
    `, sanitizeHtml, approvedPrefix);

    expect(result).not.toContain("tracker.example");
    expect(result).toContain(`${approvedPrefix}temp/image.png`);
  });
});

