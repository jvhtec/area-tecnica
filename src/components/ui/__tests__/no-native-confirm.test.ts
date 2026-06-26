import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Regression guard for docs/UI_UX_AUDIT.md M-1: blocking, unstyled
 * `window.confirm` / `window.alert` dialogs are replaced by the themed
 * `useConfirm` dialog. This test fails if a new native dialog sneaks back in,
 * so the migration stays complete.
 */

const SRC_DIR = join(process.cwd(), "src")

// The confirm-dialog implementation references the pattern in its JSDoc only.
const ALLOWLIST = new Set(["components/ui/confirm-dialog.tsx"])

// Intentionally scoped to the explicit `window.` member form — i.e. exactly what
// the M-1 migration removed and the most likely reintroduction. Matching a *bare*
// `confirm(` is not safe with a text scan: the migrated code uses a local binding
// `const confirm = useConfirm()` and calls `confirm(...)`, so it would false-positive
// across the whole migration. Bare `alert(`/`prompt(` also have pre-existing,
// out-of-scope usages (e.g. JobCardDocuments, SoundVisionFileUploader). Catching
// those correctly needs scope-aware AST analysis, which is overkill for a guard test.
const NATIVE_DIALOG = /\bwindow\.(confirm|alert|prompt)\s*\(/

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue
      collectSourceFiles(full, acc)
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.test\.(tsx?|jsx?)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

describe("no native window.confirm/alert in app source", () => {
  it("uses the themed useConfirm dialog everywhere", () => {
    const offenders: string[] = []
    for (const file of collectSourceFiles(SRC_DIR)) {
      const rel = file.slice(SRC_DIR.length + 1).replace(/\\/g, "/")
      if (ALLOWLIST.has(rel)) continue
      if (NATIVE_DIALOG.test(readFileSync(file, "utf8"))) {
        offenders.push(rel)
      }
    }

    expect(offenders, `Use useConfirm() instead of window.confirm/alert in: ${offenders.join(", ")}`).toEqual([])
  })
})
