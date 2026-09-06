# September audit bundle remediation

PERF-01 requires headroom below the existing ceiling and heavy libraries outside initial route graphs. The production build now emits a Vite manifest; `budget:bundle` checks both total gzip (including public scripts) and deduplicated static imports for the public entry, authenticated shell and technician entry. Missing manifests/assets fail closed. Dynamic imports are excluded only from initial-route measurements, never from the overall total.

## Changes

- Pinned Terser 5.44.0 provides production minification using ES2020-safe transforms, without unsafe compression or property mangling. The service worker is minified only after its build timestamp is inserted; development builds keep its readable source. Source/minified tests pin lifecycle registration, deployment-specific caches, cross-origin/mutation bypass and stale-asset rejection.
- Shared icons, dates and UI primitives have explicit chunks. App-aware subscription/status widgets remain outside the primitives chunk. Babel helpers are explicitly separated so shared signature/UI helpers cannot pull in PDF engines. Existing lazy maps, spreadsheet and rasterizer boundaries remain.
- ExcelJS uses its published `exceljs.bare.min.js` browser build. This drops redundant core-js global polyfills, not workbook features; the supported modern PWA browsers provide those ES built-ins. Styled Unicode/date/number/merge round-trip tests and a real Chrome write/read probe exercise the chosen build.
- The unused jsPDF SVG renderer resolves to a throwing stub, matching the existing unused HTML renderer policy. A source guard rejects ordinary property/string-indexed calls to those omitted renderers. Future use must remove the alias and restore the dependency. This guard is not arbitrary dynamic-call analysis.
- Incident-report generation and payout PDF merging now import their generators on demand inside existing error-handled actions. RF display helpers import specific festival-format modules instead of the pagination-exporting barrel. No payout calculations, data mutations or document content are changed.
- Desktop and mobile smoke jobs now build and preview the production bundle with local mocked Supabase configuration. They no longer validate only the development module graph.

## Measured local production checkpoint

Total JavaScript gzip: **2,974,349 bytes**, including `sw.js`, below the unchanged 3,500,000-byte absolute ceiling with **15.0186% headroom**. The new reserve limit is 2,975,000 bytes; this intentionally leaves little growth allowance and requires future work to preserve the reserve rather than raise the ceiling. Content hashes, build time and deployment environment can vary the exact bytes slightly; CI and deployment builds must both pass.

Initial static graphs measure approximately 337 KiB public, 342 KiB authenticated shell and 572 KiB technician entry. Their ceilings are 425,000 / 435,000 / 700,000 bytes respectively; the entry JavaScript file alone is not presented as the total route cost. No map, PDF, spreadsheet or html2canvas-pro engine appears in these initial graphs. This is a build-graph check, not a real-user latency or complete network-waterfall measurement.

Validation includes the existing production desktop smoke suite (22 passes, seven viewport-specific skips), a full application suite, protected coverage, strict types, governance and negative fixtures for route budgets. The Chrome workbook probe returned the original Unicode name and numeric amount after saving/loading a 6,451-byte workbook. It did not submit data or send messages to production.

Rollback is a code revert followed by a normal production build/deploy. Do not raise bundle ceilings to hide a regression. No database migration or Supabase function deployment is required.
