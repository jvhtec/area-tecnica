---
description: Visually verify a UI change in a real browser at both desktop and mobile viewports, without needing live Supabase credentials — reuses this repo's e2e mock-auth harness since most routes sit behind ProtectedRoute.
---

Visually verify: $ARGUMENTS (a route, e.g. "/dashboard as management", or "the new expense form")

Most routes in this app require Supabase auth (`ProtectedRoute`), so `npm run dev` + opening a browser only gets you the login screen — there's no live account to sign in with here. This repo already solved that problem for its own e2e suite: `tests/e2e/support/app.ts` exports `bootstrapApp(page, { auth, tables, rpc, functions })`, which seeds a fake session into `localStorage` and intercepts every `/supabase/*` request so the app renders as if fully authenticated. Reuse it instead of trying to log in for real.

## Steps

1. **Write a throwaway spec**, not a permanent test: `tests/e2e/_manual-ui-check.spec.ts`. Import `bootstrapApp` from `./support/app`, navigate to the route(s) in question, and screenshot to the scratchpad directory (not `docs/` or anywhere git-tracked):
   ```typescript
   import { test } from "@playwright/test";
   import { bootstrapApp } from "./support/app";

   test("manual UI check", async ({ page }) => {
     await bootstrapApp(page, {
       auth: { role: "management", department: "sound" }, // match the role/dept relevant to what you're checking
       tables: { /* stub whatever tables the page queries — check an existing spec for the closest route to copy realistic shapes from */ },
     });
     await page.goto("/your-route");
     await page.screenshot({ path: "/absolute/path/to/scratchpad/ui-check-<name>.png", fullPage: true });
   });
   ```
   Look at an existing spec touching the same page (`tests/e2e/*.spec.ts`) for the actual table/RPC shapes that route queries — guessing empty mocks often just renders an empty/loading state, which isn't a real check.

2. **Run it at both viewports** — this repo's Playwright config has a `chromium` (desktop) and `mobile-chromium` (iPhone 13, 390×844) project:
   ```bash
   npx playwright test tests/e2e/_manual-ui-check.spec.ts --project=chromium
   npx playwright test tests/e2e/_manual-ui-check.spec.ts --project=mobile-chromium
   ```

3. **Read the screenshots** (the `Read` tool displays images) and actually look — don't just confirm the script ran without error. Check: layout breaks, content cut off or overlapping, touch target sizing on mobile (44px+ tap targets), and that visible text is Spanish (this app's UI language), not English.

4. **Clean up**: delete `tests/e2e/_manual-ui-check.spec.ts` when done. Never commit it — it's scaffolding for this check, not a real regression test. If the check reveals something worth permanent coverage, that belongs in a properly named spec, written deliberately, not this throwaway.

## What NOT to do
Don't run `npm run perf:baseline` for this. It's a full, deliberate baseline capture — production build, preview server, Lighthouse, screenshots across every route in `scripts/performance/collect-phase4-baseline.mjs` — and it overwrites `docs/performance/phase-4-baseline/baseline.json`, which `npm run budget:bundle` diffs against in CI. Regenerating it for a one-off visual check is slow and silently resets a reviewed, git-tracked file.
