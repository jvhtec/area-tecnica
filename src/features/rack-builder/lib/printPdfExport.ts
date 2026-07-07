export type PdfFormat = 'a3'
export type PdfOrientation = 'landscape' | 'portrait'
export type PdfQualityMode = 'balanced'

export interface PdfExportProgress {
  phase: 'preparing' | 'rendering' | 'assembling' | 'downloading'
  page: number
  totalPages: number
  message: string
}

export interface ExportPrintSheetsToPdfOptions {
  rootElement: HTMLElement
  fileName: string
  format?: PdfFormat
  orientation?: PdfOrientation
  qualityMode?: PdfQualityMode
  onProgress?: (progress: PdfExportProgress) => void
}

interface PageSizeMm {
  widthMm: number
  heightMm: number
}

const EXPORT_ROOT_CLASS = 'layout-print-exporting'
const FORCE_LIGHT_CLASS = 'layout-print-force-light'
const SHEET_SELECTOR = '.layout-print-sheet'
const EXPORT_IGNORE_SELECTORS = ['.layout-print-toolbar', '[data-pdf-export-ignore="true"]']
const DEFAULT_FILE_NAME = 'rack-builder-export.pdf'
let pdfLibrariesPromise: Promise<{
  html2canvas: typeof import('html2canvas-pro').default
  jsPDF: typeof import('jspdf').jsPDF
}> | null = null

export function sanitizePdfFilename(input: string): string {
  const withoutExtension = input.trim().replace(/\.pdf$/i, '')
  const strippedControls = Array.from(withoutExtension)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')

  const cleaned = strippedControls
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const baseName = (cleaned || DEFAULT_FILE_NAME.replace(/\.pdf$/i, '')).slice(0, 120)
  return `${baseName}.pdf`
}

export function getPdfPageSizeMm(format: PdfFormat, orientation: PdfOrientation): PageSizeMm {
  if (format !== 'a3') {
    throw new Error(`Unsupported PDF format: ${format}`)
  }

  const shortSideMm = 297
  const longSideMm = 420
  if (orientation === 'landscape') {
    return { widthMm: longSideMm, heightMm: shortSideMm }
  }

  return { widthMm: shortSideMm, heightMm: longSideMm }
}

export function isLikelyMobileDevice(viewportWidth: number, userAgent: string): boolean {
  if (viewportWidth <= 900) return true
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
}

export function getBalancedScaleCandidates(args: {
  isMobile: boolean
  devicePixelRatio: number
}): number[] {
  const normalizedDpr = Number.isFinite(args.devicePixelRatio)
    ? Math.max(1, Math.min(4, args.devicePixelRatio))
    : 1

  // Target high-definition output: 3x on desktop, 2.5x on mobile.
  // Falls back to progressively lower scales if the device runs out of memory.
  const startScale = args.isMobile
    ? Math.min(2.8, Math.max(2, normalizedDpr * 1.4))
    : Math.min(3.5, Math.max(2.8, normalizedDpr * 1.4))

  const fallbackSeed = args.isMobile
    ? [startScale, 2.5, 2.2, 2, 1.8, 1.6, 1.4]
    : [startScale, 3, 2.8, 2.5, 2.2, 2, 1.8]

  const deduped = Array.from(
    new Set(
      fallbackSeed
        .map((value) => Number(value.toFixed(2)))
        .filter((value) => value >= 1.4 && value <= 4),
    ),
  )

  deduped.sort((a, b) => b - a)
  return deduped
}

async function waitForFontsAndPaint(): Promise<void> {
  if ('fonts' in document) {
    try {
      await document.fonts.ready
    } catch {
      // Font loading failures should not block export.
    }
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Failed to export PDF.'
}

function isIosDevice(): boolean {
  return /iP(ad|hone|od)/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function shouldIgnorePdfCloneElement(element: Element): boolean {
  return EXPORT_IGNORE_SELECTORS.some((selector) => element.matches(selector))
}

/**
 * Rewrite CSS text to remove color functions that html2canvas-pro cannot parse.
 *
 * html2canvas-pro supports oklab/oklch/lab/lch/color, but NOT color-mix().
 * Tailwind v4 emits `color-mix(in oklab, …)` for opacity variants and wraps
 * them in `@supports` blocks with hex fallbacks before them.  Stripping these
 * blocks is safe because the hex fallback is always emitted first.
 *
 * Also converts any remaining bare oklab() values and gradient "in oklab"
 * hints to sRGB equivalents as a safety net.
 */
function rewriteUnsupportedColorsInCss(css: string): string {
  if (!css.includes('oklab') && !css.includes('color-mix')) return css

  // 1. Remove @supports blocks that wrap color-mix overrides – the hex
  //    fallback emitted before them is sufficient for rendering.
  css = css.replace(
    /@supports\s*\([^)]*color-mix[^)]*\)\s*\{[^{}]*\{[^}]*\}\s*\}/g,
    '',
  )

  // 2. Replace standalone color-mix() calls with a safe opaque fallback.
  //    Nested parentheses are handled by matching up to 2 levels deep.
  css = css.replace(
    /color-mix\((?:[^()]*|\((?:[^()]*|\([^()]*\))*\))*\)/g,
    'rgb(0, 0, 0)',
  )

  // 3. Strip "in oklab" / "in oklch" from gradient interpolation hints.
  css = css.replace(
    /\b(to\s+(?:top|bottom|left|right)(?:\s+(?:top|bottom|left|right))?)\s+in\s+ok(?:lab|lch)\b/g,
    '$1',
  )

  return css
}

/**
 * Walk all `<style>` elements and inline `style` attributes in the cloned
 * document, stripping unsupported CSS color functions (primarily color-mix)
 * so that html2canvas-pro can parse them.
 */
function neutralizeUnsupportedColors(documentClone: Document): void {
  for (const styleEl of Array.from(documentClone.querySelectorAll('style'))) {
    const text = styleEl.textContent ?? ''
    if (text.includes('oklab') || text.includes('color-mix')) {
      styleEl.textContent = rewriteUnsupportedColorsInCss(text)
    }
  }

  for (const el of Array.from(documentClone.querySelectorAll<HTMLElement>('[style]'))) {
    const style = el.getAttribute('style') ?? ''
    if (style.includes('oklab') || style.includes('color-mix')) {
      el.setAttribute('style', rewriteUnsupportedColorsInCss(style))
    }
  }
}

function prunePdfClone(documentClone: Document, clonedSheet: HTMLElement) {
  const clonedRoot = clonedSheet.closest(`.${EXPORT_ROOT_CLASS}`) ?? documentClone
  clonedRoot.querySelectorAll(EXPORT_IGNORE_SELECTORS.join(', ')).forEach((node) => node.remove())
  neutralizeUnsupportedColors(documentClone)
}

const MODERN_COLOR_RE = /oklch\([^)]*\)|oklab\([^)]*\)/gi

/**
 * Temporarily rewrite oklch()/oklab() in the **live** document's stylesheets
 * to sRGB hex so that html2canvas (which cannot parse modern CSS colour
 * functions) inherits clean values when it clones the DOM.
 *
 * Modifying the original document before cloning is the only reliable
 * strategy because:
 *  - Linked stylesheets (<link>) may not be accessible via CSSOM in the
 *    html2canvas clone (the clone's sheets haven't loaded yet).
 *  - Pseudo-elements (::before, ::after) and CSS custom properties can
 *    carry oklch/oklab but can't be patched via inline style overrides.
 *
 * Returns a cleanup function that restores every modified stylesheet.
 */
function applyColorNormalization(): () => void {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const safeCtx = ctx

  function toSrgb(color: string): string {
    safeCtx.fillStyle = '#000000'
    safeCtx.fillStyle = color
    return safeCtx.fillStyle
  }

  function replaceModernColors(text: string): string {
    return text.replace(MODERN_COLOR_RE, (match) => toSrgb(match))
  }

  const cleanups: Array<() => void> = []

  for (const sheet of Array.from(document.styleSheets)) {
    if (!sheet.ownerNode) continue
    try {
      let cssText = ''
      for (const rule of sheet.cssRules) {
        cssText += rule.cssText + '\n'
      }
      if (!MODERN_COLOR_RE.test(cssText)) continue
      MODERN_COLOR_RE.lastIndex = 0

      // Physically replace the owner node (<link> or <style>) with a
      // rewritten <style>.  We cannot just set sheet.disabled = true
      // because that is a CSSOM property — when html2canvas clones the
      // DOM into its iframe the cloned <link> gets a *new* non-disabled
      // CSSStyleSheet that re-fetches the original oklch/oklab CSS.
      const ownerNode = sheet.ownerNode as Element
      const parent = ownerNode.parentNode
      if (!parent) continue

      const replacement = document.createElement('style')
      replacement.textContent = replaceModernColors(cssText)
      parent.replaceChild(replacement, ownerNode)

      cleanups.push(() => {
        parent.replaceChild(ownerNode, replacement)
      })
    } catch {
      // Cross-origin stylesheet – cannot read rules, skip.
    }
  }

  return () => cleanups.forEach((fn) => fn())
}

/**
 * Patch any remaining oklch/oklab in inline style attributes on the
 * html2canvas clone (fast – only touches elements with a style attr).
 */
function normalizeCloneInlineStyles(documentClone: Document) {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const safeCtx = ctx

  function replaceModernColors(text: string): string {
    return text.replace(MODERN_COLOR_RE, (match) => {
      safeCtx.fillStyle = '#000000'
      safeCtx.fillStyle = match
      return safeCtx.fillStyle
    })
  }

  for (const el of documentClone.querySelectorAll('[style]')) {
    const raw = el.getAttribute('style')
    if (raw && MODERN_COLOR_RE.test(raw)) {
      MODERN_COLOR_RE.lastIndex = 0
      el.setAttribute('style', replaceModernColors(raw))
    }
  }
}

async function triggerPdfDownload(blob: Blob, fileName: string): Promise<void> {
  // Web Share API requires a recent user activation. After a long async
  // render pipeline the gesture is typically expired, so we skip it and
  // go straight to the most reliable download path per platform.
  const ios = isIosDevice()

  // Strategy 1 (non-iOS): anchor with download attribute — universally
  // supported on Chrome, Firefox, Edge, and desktop Safari 14.1+.
  if (!ios && 'download' in HTMLAnchorElement.prototype) {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    return
  }

  // Strategy 2 (iOS): open the PDF blob in the current tab. iOS Safari
  // blocks window.open and target=_blank from async contexts, but
  // navigating the current location to a blob URL works reliably and
  // triggers the native iOS PDF viewer with its built-in share/save.
  if (ios) {
    const objectUrl = URL.createObjectURL(blob)
    // Attempt Web Share first — it works on iOS 15+ when user activation
    // hasn't expired. We try it but don't rely on it.
    const file = new File([blob], fileName, { type: 'application/pdf' })
    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: fileName })
        URL.revokeObjectURL(objectUrl)
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          URL.revokeObjectURL(objectUrl)
          return
        }
        // Web Share failed (likely expired gesture) — fall through
      }
    }

    // Navigate to the blob URL. This opens the iOS PDF viewer inline,
    // where the user can tap the share icon to save/send the file.
    window.location.href = objectUrl
    // Don't revoke immediately — the navigation needs the URL alive.
    return
  }

  // Strategy 3 (fallback): open in new tab for other platforms
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.target = '_blank'
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

/**
 * Compute the pixel dimensions for rasterising sheets at ~2× screen density.
 * The long side is 1400px (matching the A-series √2 ratio), flipped for portrait.
 */
const EXPORT_LONG_SIDE_PX = 1400
const EXPORT_SHORT_SIDE_PX = 990

export function getExportSheetSizePx(orientation: PdfOrientation): { widthPx: number; heightPx: number } {
  if (orientation === 'portrait') {
    return { widthPx: EXPORT_SHORT_SIDE_PX, heightPx: EXPORT_LONG_SIDE_PX }
  }
  return { widthPx: EXPORT_LONG_SIDE_PX, heightPx: EXPORT_SHORT_SIDE_PX }
}

const ORIENTATION_CLASS_LANDSCAPE = 'layout-print-exporting-landscape'
const ORIENTATION_CLASS_PORTRAIT = 'layout-print-exporting-portrait'

async function renderAtScale({
  sheets,
  scale,
  pageSizeMm,
  orientation,
  onProgress,
}: {
  sheets: HTMLElement[]
  scale: number
  pageSizeMm: PageSizeMm
  orientation: PdfOrientation
  onProgress?: (progress: PdfExportProgress) => void
}): Promise<Blob> {
  const { html2canvas, jsPDF } = await loadPdfLibraries()
  const { widthPx, heightPx } = getExportSheetSizePx(orientation)

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pageSizeMm.widthMm, pageSizeMm.heightMm],
    compress: true,
    putOnlyUsedFonts: true,
  })

  // Rewrite oklch/oklab in the live document's stylesheets so that
  // html2canvas clones already-normalised CSS (covers <link> sheets,
  // pseudo-elements, and CSS custom properties).
  const restoreColors = applyColorNormalization()

  try {
  for (let index = 0; index < sheets.length; index += 1) {
    const pageNumber = index + 1
    onProgress?.({
      phase: 'rendering',
      page: pageNumber,
      totalPages: sheets.length,
      message: `Rendering page ${pageNumber} of ${sheets.length}...`,
    })

    const canvas = await html2canvas(sheets[index], {
      backgroundColor: '#ffffff',
      scale,
      width: widthPx,
      height: heightPx,
      ignoreElements: shouldIgnorePdfCloneElement,
      onclone: (documentClone, clonedSheet) => {
        prunePdfClone(documentClone, clonedSheet)
        normalizeCloneInlineStyles(documentClone)
      },
      useCORS: true,
      allowTaint: false,
      imageTimeout: 15000,
      logging: false,
      removeContainer: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: widthPx,
      windowHeight: heightPx,
    })

    if (index > 0) {
      pdf.addPage([pageSizeMm.widthMm, pageSizeMm.heightMm], orientation)
    }

    // PNG preserves crisp text and line art for high-definition output.
    const imageData = canvas.toDataURL('image/png')
    pdf.addImage(imageData, 'PNG', 0, 0, pageSizeMm.widthMm, pageSizeMm.heightMm)
    canvas.width = 1
    canvas.height = 1
  }

  onProgress?.({
    phase: 'assembling',
    page: sheets.length,
    totalPages: sheets.length,
    message: 'Finalizing PDF...',
  })

  return pdf.output('blob')
  } finally {
    restoreColors()
  }
}

async function loadPdfLibraries() {
  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = Promise.all([import('html2canvas-pro'), import('jspdf')]).then(
      ([html2canvasModule, jsPdfModule]) => ({
        html2canvas: html2canvasModule.default,
        jsPDF: jsPdfModule.jsPDF,
      }),
    )
    // If the dynamic import fails (e.g. network error), clear the cached
    // promise so a subsequent call can retry instead of replaying the failure.
    pdfLibrariesPromise.catch(() => {
      pdfLibrariesPromise = null
    })
  }

  return pdfLibrariesPromise
}

export async function exportPrintSheetsToPdf({
  rootElement,
  fileName,
  format = 'a3',
  orientation = 'landscape',
  qualityMode = 'balanced',
  onProgress,
}: ExportPrintSheetsToPdfOptions): Promise<void> {
  const sheets = Array.from(rootElement.querySelectorAll<HTMLElement>(SHEET_SELECTOR))
  if (sheets.length === 0) {
    throw new Error('No printable sheets found on this page.')
  }

  const normalizedFileName = sanitizePdfFilename(fileName)
  const pageSizeMm = getPdfPageSizeMm(format, orientation)
  const isMobile = isLikelyMobileDevice(window.innerWidth, navigator.userAgent)

  const scales =
    qualityMode === 'balanced'
      ? getBalancedScaleCandidates({
          isMobile,
          devicePixelRatio: window.devicePixelRatio || 1,
        })
      : [2]

  const orientationClass =
    orientation === 'portrait' ? ORIENTATION_CLASS_PORTRAIT : ORIENTATION_CLASS_LANDSCAPE

  const hadExportRootClass = rootElement.classList.contains(EXPORT_ROOT_CLASS)
  const hadForceLightClass = document.documentElement.classList.contains(FORCE_LIGHT_CLASS)
  const hadDarkClass = document.documentElement.classList.contains('dark')
  if (!hadExportRootClass) rootElement.classList.add(EXPORT_ROOT_CLASS)
  rootElement.classList.add(orientationClass)
  if (!hadForceLightClass) document.documentElement.classList.add(FORCE_LIGHT_CLASS)
  if (hadDarkClass) document.documentElement.classList.remove('dark')

  try {
    onProgress?.({
      phase: 'preparing',
      page: 0,
      totalPages: sheets.length,
      message: 'Preparing export...',
    })

    await waitForFontsAndPaint()

    // Eagerly load PDF libraries before the scale-fallback loop so that
    // import failures (network errors, missing chunks) surface immediately
    // rather than being silently retried at every quality level.
    await loadPdfLibraries()

    let lastError: unknown = null
    for (const scale of scales) {
      try {
        const pdfBlob = await renderAtScale({
          sheets,
          scale,
          pageSizeMm,
          orientation,
          onProgress,
        })

        onProgress?.({
          phase: 'downloading',
          page: sheets.length,
          totalPages: sheets.length,
          message: 'Downloading PDF...',
        })

        await triggerPdfDownload(pdfBlob, normalizedFileName)
        return
      } catch (error) {
        lastError = error
      }
    }

    throw new Error(`PDF export failed after quality fallback attempts. ${toErrorMessage(lastError)}`)
  } finally {
    if (hadDarkClass) document.documentElement.classList.add('dark')
    rootElement.classList.remove(orientationClass)
    if (!hadExportRootClass) rootElement.classList.remove(EXPORT_ROOT_CLASS)
    if (!hadForceLightClass) document.documentElement.classList.remove(FORCE_LIGHT_CLASS)
  }
}
