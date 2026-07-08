#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const workflowsRoot = join(repoRoot, ".github", "workflows");
const fullShaPattern = /^[a-f0-9]{40}$/i;
const problems = [];

function listWorkflowFiles(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return listWorkflowFiles(path);
      return /\.(ya?ml)$/i.test(entry) ? [path] : [];
    })
    .sort();
}

for (const file of listWorkflowFiles(workflowsRoot)) {
  const rel = relative(repoRoot, file);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*uses:\s*([^#\s]+)(?:\s+#.*)?$/);
    if (!match) return;

    const spec = match[1].replace(/^["']|["']$/g, "");
    if (spec.startsWith("./") || spec.startsWith("docker://")) return;

    const at = spec.lastIndexOf("@");
    if (at === -1) {
      problems.push(`${rel}:${index + 1} "${spec}" must be pinned to a full commit SHA.`);
      return;
    }

    const ref = spec.slice(at + 1);
    if (!fullShaPattern.test(ref)) {
      problems.push(`${rel}:${index + 1} "${spec}" uses "${ref}", not a full commit SHA.`);
    }
  });
}

if (problems.length > 0) {
  console.error("GitHub Actions must be pinned by full 40-character commit SHA:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log("OK: all external GitHub Actions are pinned by full commit SHA.");
