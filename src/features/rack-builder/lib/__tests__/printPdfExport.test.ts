import { describe, expect, it } from 'vitest'
import {
  getBalancedScaleCandidates,
  getPdfPageSizeMm,
  isLikelyMobileDevice,
  sanitizePdfFilename,
} from '../printPdfExport'

describe('printPdfExport helpers', () => {
  it('sanitizes invalid characters and enforces .pdf extension', () => {
    expect(sanitizePdfFilename(' Project: Rack/Alpha*Draft  ')).toBe('Project-Rack-Alpha-Draft.pdf')
    expect(sanitizePdfFilename('already-good.pdf')).toBe('already-good.pdf')
  })

  it('returns deterministic A3 page size in landscape', () => {
    expect(getPdfPageSizeMm('a3', 'landscape')).toEqual({
      widthMm: 420,
      heightMm: 297,
    })
  })

  it('selects mobile and desktop quality fallback ladders differently', () => {
    const mobile = getBalancedScaleCandidates({ isMobile: true, devicePixelRatio: 2 })
    const desktop = getBalancedScaleCandidates({ isMobile: false, devicePixelRatio: 2 })

    expect(mobile[0]).toBeLessThanOrEqual(2.8)
    expect(mobile[0]).toBeGreaterThanOrEqual(2)
    expect(mobile.at(-1)).toBe(1.4)
    expect(desktop[0]).toBeGreaterThanOrEqual(2.8)
    expect(desktop.at(-1)).toBe(1.8)
  })

  it('detects likely mobile devices by viewport or user agent', () => {
    expect(isLikelyMobileDevice(800, 'Mozilla/5.0')).toBe(true)
    expect(isLikelyMobileDevice(1200, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true)
    expect(isLikelyMobileDevice(1440, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
  })
})
