# QLT-07: verified unreachable application modules

Removed 111 unreachable source modules and moved the 153-line Flex dialog usage example to `docs/examples/`. The independently traced unreachable set contained 112 modules / 18,093 source lines, including dependencies of abandoned components. Git history retains every removed file.

The TypeScript compiler resolver followed static imports, re-exports, import types, literal dynamic imports and require calls across 2,070 tracked code modules. Roots included `src/main.tsx`, all tests, declarations, scripts/configuration outside `src`, legacy code, Vite stubs and shared UI primitives. No nonliteral dynamic imports or unresolved code imports were found; the sole unresolved asset was the intentional `UserManual.md?url` import. Shared primitives and the Vite html2canvas alias stub were preserved even where no conventional route import reached them.

Removed clusters include obsolete dashboard/tour-scheduling components and their private hooks/types/PDF utilities. The active optimistic deletion service remains; its stale documentation reference was corrected. No route registration, database schema, active rendering implementation, or dependency was changed.

Verification on 2026-09-05: strict typecheck passed; 367 Vitest files / 2,049 tests passed; critical tests and enforced coverage passed; production build and bundle budget passed; Chromium smoke passed 22 tests with 7 pre-existing configured skips. Governance passed. Regenerated ratchets reduce lint warnings to 1,145, UI legacy data-layer imports to 176, scheduling date-constructor matches to 43, and mobile tiny-text matches to 241.

This removes unreachable code, not bundled assets: tree-shaking already excluded it, so no bundle-size improvement is claimed. Rollback is a revert of the cleanup commit; no data rollback is necessary.
