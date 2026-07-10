import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const publicDir = path.join(root, "public");
const headers = await readFile(path.join(publicDir, "_headers"), "utf8");
const policyMatch = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m);

if (!policyMatch) {
  throw new Error("public/_headers must define an enforced Content-Security-Policy");
}

const policy = policyMatch[1];
const scriptDirective = policy.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] ?? "";

for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'"]) {
  if (scriptDirective.includes(forbidden)) {
    throw new Error(`script-src must not contain ${forbidden}`);
  }
}

if (!/(?:^|;)\s*script-src-attr\s+'none'(?:;|$)/.test(policy)) {
  throw new Error("CSP must disable inline event handlers with script-src-attr 'none'");
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
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  for (const [, attributes, content] of scripts) {
    if (/\bsrc\s*=/.test(attributes) || !content.trim()) continue;
    inlineScriptCount += 1;
    const digest = createHash("sha256").update(content).digest("base64");
    const source = `'sha256-${digest}'`;
    if (!scriptDirective.includes(source)) {
      missing.push(`${path.relative(root, file)}: ${source}`);
    }
  }
}

if (missing.length > 0) {
  throw new Error(`CSP is missing inline-script hashes:\n${missing.join("\n")}`);
}

console.log(`CSP governance passed: enforced policy covers ${inlineScriptCount} inline scripts without unsafe script execution.`);
