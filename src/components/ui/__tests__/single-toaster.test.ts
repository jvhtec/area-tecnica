import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Regression guard for docs/UI_UX_AUDIT.md H-2: the app has a single toast
 * renderer (Sonner). The legacy Radix `@/components/ui/toaster` was removed and
 * `@/hooks/use-toast` is now a thin adapter over Sonner. This test fails if the
 * dead Radix toaster is reintroduced/imported, which would bring back the
 * dual-toast-UI problem.
 */

const SRC_DIR = join(process.cwd(), "src")

const RADIX_TOASTER_IMPORT = /from\s+['"]@\/components\/ui\/toaster['"]/

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (entry === "node_modules") continue
      collectSourceFiles(full, acc)
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

describe("single toast renderer (Sonner)", () => {
  it("nothing imports the removed Radix @/components/ui/toaster", () => {
    const offenders: string[] = []
    for (const file of collectSourceFiles(SRC_DIR)) {
      if (RADIX_TOASTER_IMPORT.test(readFileSync(file, "utf8"))) {
        offenders.push(file.slice(SRC_DIR.length + 1).replace(/\\/g, "/"))
      }
    }
    expect(
      offenders,
      `Use Sonner (one <Toaster>) — do not import the removed Radix toaster: ${offenders.join(", ")}`,
    ).toEqual([])
  })
})
