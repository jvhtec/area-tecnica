# SEC-02: private cache account isolation

Private festival snapshots, files and queued edits previously shared a browser database across accounts. This release gives each account a database and scopes readable snapshots/files to its role, department and access flags. Unsent edits remain with their author across permission changes. The server still authorizes every replay.

Identity changes abort active storage/network work, clear query state, remount private UI and separate multi-tab channels and leader locks. Private mutation callbacks and retries cannot restore a previous account's cache. Festival network operations pin the initiating session token. IndexedDB saves resolve only after transaction commit.

Offline fallback accepts recognized transport failures only. Authorization denials, including denials arriving after the cached-response timeout, revoke the snapshot, remove cached files and invalidate the private view. Queued edits are retained. A device cannot discover a server-side revocation while disconnected; cached access is withdrawn once the server reports it.

Online festival reads additionally check the current server role and the technician's assignment, because RLS can report successful empty results after access is removed. Snapshot downloads check access before fetching and before saving. Late assignment denials revoke the cache even if a transport failure already served it. Synchronization stops at an authorization denial and preserves the remaining queue. Missing optional rows (`PGRST116`) are not authorization denials. Storage downloads retain cached files after their own timeout, while HTTP denials and missing objects still remove them. Account-change cancellation remains active through response-body consumption, including on older webviews without `AbortSignal.any`.

## Existing offline data

The old `sector-pro-offline` database is retained, but its records are never loaded or replayed by the new account-scoped APIs. Old queued edits have no trustworthy author field. The UI reports their count and directs the user to administration before clearing browser data; it does not assign those edits to whichever account happens to sign in. Recovering those legacy edits requires an administrator to establish ownership outside the automatic sync flow. Download a fresh snapshot for normal offline use.

## Verification

- Full Vitest suite: 367 files, 2,037 tests passed.
- Final mutation/type adjustment: seven focused tests passed; application typecheck passed.
- Critical suite: 109 tests plus 29 coverage-gated tests passed.
- Lint: zero errors; existing warning baseline retained. Governance passed, including zero dependency advisories.
- Production build, bundle budgets and Capacitor Android/iOS/web sync passed. Largest entry: 112.9 kB gzip; total JavaScript: 3.10 MB gzip.
- Existing Chromium E2E suite: 22 passed, seven project/fixture skips. Supabase is mocked in this suite.
- Separate three-tab Chrome probe used the real IndexedDB, BroadcastChannel and Web Locks implementations: same-account sharing succeeded; account B had no account A snapshot, file, queue or broadcast cache while offline; returning to A retained its queued edit. A transaction aborted after request success rejected the save and left no row. This probe drives the real auth-boundary helper directly rather than performing production login.
- Regression tests were run against the earlier implementations and failed for account isolation, transaction abort, in-flight operations, stale auth/profile responses, cross-account query reuse, cross-tab messages, late authorization denial and stale mutation callbacks/retries before passing with the fixes.

Review follow-up (2026-09-05): the final full suite passed 2,049 tests across 367 files; the 69 focused offline/client tests cover all five actionable review findings and older-webview cancellation. Negative controls reproduced silent RLS cache retention, timeout data loss, replay after denial, mistaken missing-row revocation, and cancellation ending at response headers. Typecheck, lint, governance, critical coverage, production build and bundle budget passed. Browser smoke fixtures now provide the new server-role RPC response.

## Release and rollback

No database migration or Edge Function change: deploy through the normal main/Cloudflare path. No production Supabase push is needed.

If rollback is required, prefer a forward fix retaining account isolation. A full code revert restores the vulnerable legacy cache reader; it also cannot read new per-account queued edits. Preserve browser storage and reintroduce the corrected account-scoped reader before attempting sync. Do not delete databases to force a rollback.
