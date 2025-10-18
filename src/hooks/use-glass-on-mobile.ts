import * as React from "react"

import { useIsMobile } from "./use-mobile"

type FeatureFlagOption = boolean | string | undefined

export interface UseGlassOnMobileOptions {
  /** Allow the hook to enable glass surfaces even when the viewport is desktop sized. */
  allowDesktop?: boolean
  /** Hard-disable the glass effect regardless of heuristics. */
  disabled?: boolean
  /** Minimum device memory (in GB) required to render the glass shader. Defaults to 3. */
  minimumDeviceMemory?: number
  /** Optional feature flag. Provide a boolean to hard-enable/disable or a localStorage key string to resolve dynamically. */
  featureFlag?: FeatureFlagOption
}

function resolveFeatureFlag(option: FeatureFlagOption) {
  if (typeof option === "boolean" || typeof option === "undefined") {
    return option ?? true
  }

  if (typeof window === "undefined") {
    return false
  }

  const storedValue = window.localStorage.getItem(option)
  if (storedValue == null) {
    return true
  }

  return ["true", "1", "enabled", "on"].includes(storedValue.toLowerCase())
}

export function useGlassOnMobile(options?: UseGlassOnMobileOptions) {
  const {
    allowDesktop = false,
    disabled = false,
    minimumDeviceMemory = 3,
    featureFlag,
  } = options ?? {}

  const isMobile = useIsMobile()
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)
  const [isEnabled, setIsEnabled] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined" || disabled) {
      return
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(media.matches)

    updatePreference()
    media.addEventListener("change", updatePreference)

    return () => media.removeEventListener("change", updatePreference)
  }, [disabled])

  React.useEffect(() => {
    if (disabled) {
      setIsEnabled(false)
      return
    }

    if (typeof window === "undefined") {
      setIsEnabled(false)
      return
    }

    const featureFlagEnabled = resolveFeatureFlag(featureFlag)
    if (!featureFlagEnabled) {
      setIsEnabled(false)
      return
    }

    const memory =
      typeof navigator !== "undefined" && "deviceMemory" in navigator
        ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
        : undefined

    const connection =
      typeof navigator !== "undefined" && "connection" in navigator
        ? (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
        : undefined

    const lowMemory = typeof memory === "number" && memory > 0 && memory < minimumDeviceMemory
    const saveData = Boolean(connection?.saveData)

    const canRenderOnDevice = (allowDesktop || isMobile) && !prefersReducedMotion && !lowMemory && !saveData

    setIsEnabled(canRenderOnDevice)
  }, [allowDesktop, featureFlag, disabled, isMobile, minimumDeviceMemory, prefersReducedMotion])

  return isEnabled
}
