import { useEffect } from "react"
import { useTheme } from "next-themes"

/**
 * Keeps the browser chrome color (<meta name="theme-color">) in sync with the
 * *active app theme* selected via ThemeProvider, rather than only the OS
 * `prefers-color-scheme` (see docs/UI_UX_AUDIT.md, theme-color nitpick).
 *
 * `resolvedTheme` from next-themes already accounts for both an explicit
 * light/dark override and the "system" default, so a manual theme switch is
 * reflected immediately.
 */
const THEME_COLORS = {
  light: "#eceef2", // --background (light)
  dark: "#07090d", // --background (dark)
} as const

export function ThemeColorMeta(): null {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const color = resolvedTheme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement("meta")
      meta.setAttribute("name", "theme-color")
      document.head.appendChild(meta)
    }
    meta.setAttribute("content", color)
  }, [resolvedTheme])

  return null
}
