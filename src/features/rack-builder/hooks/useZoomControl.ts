import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_ZOOM_PERCENT,
  LAYOUT_EDITOR_ZOOM_STORAGE_KEY,
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  ZOOM_STEP_PERCENT,
  getInitialZoomPercent,
  normalizeZoomPercent,
} from '../lib/layoutEditorHelpers'

export function useZoomControl() {
  const [zoomPercent, setZoomPercent] = useState<number>(getInitialZoomPercent)

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_EDITOR_ZOOM_STORAGE_KEY, String(zoomPercent))
    } catch {
      // ignore
    }
  }, [zoomPercent])

  const handleZoomOut = useCallback(() => {
    setZoomPercent((prev) => normalizeZoomPercent(prev - ZOOM_STEP_PERCENT))
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoomPercent((prev) => normalizeZoomPercent(prev + ZOOM_STEP_PERCENT))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoomPercent(DEFAULT_ZOOM_PERCENT)
  }, [])

  return {
    zoomPercent,
    zoomFactor: zoomPercent / 100,
    canZoomOut: zoomPercent > MIN_ZOOM_PERCENT,
    canZoomIn: zoomPercent < MAX_ZOOM_PERCENT,
    handleZoomOut,
    handleZoomIn,
    handleZoomReset,
  }
}
