import { useLayoutEffect, useState, type RefObject } from 'react'

interface AutoScaleFontOptions {
  minFontPx?: number
  maxFontPx?: number
}

/**
 * Measures the container and returns the largest font size (in px)
 * at which `text` fits within the container bounds.
 * Uses binary search with an off-screen measurement element.
 */
export function useAutoScaleFont(
  containerRef: RefObject<HTMLElement | null>,
  text: string,
  options?: AutoScaleFontOptions,
): number {
  const minFont = options?.minFontPx ?? 4
  const maxFontOpt = options?.maxFontPx

  const [fontSize, setFontSize] = useState(minFont)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !text) return

    const compute = () => {
      const rect = container.getBoundingClientRect()
      const containerW = rect.width
      const containerH = rect.height
      if (containerW <= 0 || containerH <= 0) return

      const maxFont = maxFontOpt ?? Math.max(containerH * 0.9, minFont)

      // Create hidden measurement element
      const measurer = document.createElement('div')
      const style = measurer.style
      style.position = 'absolute'
      style.visibility = 'hidden'
      style.left = '-9999px'
      style.top = '-9999px'
      style.whiteSpace = 'pre-line'
      style.textAlign = 'center'
      style.lineHeight = '1.2'
      style.width = `${containerW}px`
      style.overflowWrap = 'break-word'

      // Copy font family from container
      const computed = getComputedStyle(container)
      style.fontFamily = computed.fontFamily
      style.fontWeight = computed.fontWeight

      measurer.textContent = text
      document.body.appendChild(measurer)

      // Binary search for largest fitting font size
      let lo = minFont
      let hi = maxFont
      let best = minFont

      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2
        style.fontSize = `${mid}px`
        const fits = measurer.scrollHeight <= containerH && measurer.scrollWidth <= containerW
        if (fits) {
          best = mid
          lo = mid
        } else {
          hi = mid
        }
      }

      document.body.removeChild(measurer)
      setFontSize(best)
    }

    compute()

    let rafId = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(compute)
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [containerRef, text, minFont, maxFontOpt])

  return fontSize
}
