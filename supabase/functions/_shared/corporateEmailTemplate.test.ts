import { describe, expect, it } from "vitest";

import { escapeHtml } from "./corporateEmailTemplate";

describe("escapeHtml", () => {
  it("neutralizes markup and quoted attribute payloads", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')"> & text`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt; &amp; text",
    );
  });
});
