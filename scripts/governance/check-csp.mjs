import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { JSDOM } from "jsdom";

const root = process.cwd();
const publicDir = path.join(root, "public");
const headers = await readFile(path.join(publicDir, "_headers"), "utf8");
const policyMatches = [...headers.matchAll(/^\s*Content-Security-Policy:\s*(.+)$/mg)];

if (policyMatches.length === 0) {
  throw new Error("public/_headers must define an enforced Content-Security-Policy");
}

const scriptDirectives = [];

for (const [, policy] of policyMatches) {
  const scriptDirective = policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] ?? "";
  scriptDirectives.push(scriptDirective);

  for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'"]) {
    if (scriptDirective.includes(forbidden)) {
      throw new Error(`script-src must not contain ${forbidden}`);
    }
  }

  if (!/(?:^|;)\s*script-src-attr\s+'none'(?:;|$)/.test(policy)) {
    throw new Error("CSP must disable inline event handlers with script-src-attr 'none'");
  }
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(absolute));
    else if (entry.name.endsWith(".html")) files.push(absolute);
  }
  return files;
}

const missing = [];
let inlineScriptCount = 0;
for (const file of await htmlFiles(publicDir)) {
  const html = await readFile(file, "utf8");
  const document = new JSDOM(html).window.document;
  for (const script of document.querySelectorAll("script:not([src])")) {
    const content = script.textContent ?? "";
    if (!content.trim()) continue;
    inlineScriptCount += 1;
    // Git stores these text assets with LF and Cloudflare serves those bytes.
    // Normalize Windows checkouts so the expected browser hash is portable.
    const canonicalContent = content.replace(/\r\n/g, "\n");
    const digest = createHash("sha256").update(canonicalContent).digest("base64");
    const source = `'sha256-${digest}'`;
    if (!scriptDirectives.some((directive) => directive.includes(source))) {
      missing.push(`${path.relative(root, file)}: ${source}`);
    }
  }
}

if (missing.length > 0) {
  throw new Error(`CSP is missing inline-script hashes:\n${missing.join("\n")}`);
}

console.log(`CSP governance passed: enforced policy covers ${inlineScriptCount} inline scripts without unsafe script execution.`);
