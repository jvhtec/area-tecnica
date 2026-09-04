/**
 * Stand-in for jsPDF's optional `html2canvas` dependency.
 *
 * jsPDF dynamically imports `html2canvas` inside its `.html()` renderer. This
 * app never calls `.html()`; its only rasterizer is `html2canvas-pro`, imported
 * directly by the rack builder. Without this stub Rollup follows jsPDF's
 * dynamic import and ships a second, unused copy of the library (~200 kB raw).
 *
 * Wired up in `vite.config.ts` via an anchored `resolve.alias`. It throws
 * rather than returning a no-op canvas so that a future caller of `.html()`
 * fails immediately and visibly, instead of silently producing blank PDFs.
 */
export default function html2canvasUnused(): never {
  throw new Error(
    "html2canvas is stubbed out: this app uses html2canvas-pro. If jsPDF's .html() " +
      'renderer is genuinely needed, remove the html2canvas alias in vite.config.ts.',
  );
}
