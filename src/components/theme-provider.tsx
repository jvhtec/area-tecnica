"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

import { APP_THEME_STORAGE_KEY, migrateLegacyThemePreference } from "@/lib/theme"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  if (props.storageKey === APP_THEME_STORAGE_KEY) {
    migrateLegacyThemePreference()
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
