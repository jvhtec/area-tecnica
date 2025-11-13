import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useUserPreferences } from "@/hooks/useUserPreferences"

interface ThemeToggleProps {
  display?: "sidebar" | "icon"
  className?: string
  ariaLabel?: string
}

export const ThemeToggle = ({
  display = "sidebar",
  className,
  ariaLabel,
}: ThemeToggleProps = {}) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { preferences, updatePreferences } = useUserPreferences()

  useEffect(() => {
    if (preferences?.dark_mode !== undefined) {
      const prefersDark = preferences.dark_mode
      setIsDarkMode(prefersDark)
      if (prefersDark) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }, [preferences])

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)

    if (newDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }

    updatePreferences({ dark_mode: newDarkMode })
  }

  // Global keyboard shortcut: Ctrl+Shift+D (Cmd+Shift+D on Mac)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        toggleDarkMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleDarkMode])

  const isIconDisplay = display === "icon"
  const iconSizeClass = isIconDisplay ? "h-5 w-5" : "h-4 w-4"
  const computedAriaLabel = isIconDisplay
    ? ariaLabel ?? (isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro")
    : undefined

  return (
    <Button
      type="button"
      variant="ghost"
      size={isIconDisplay ? "icon" : "default"}
      className={cn(
        isIconDisplay
          ? "h-9 w-9 rounded-full border border-border/60 bg-background/70 text-muted-foreground shadow-sm hover:bg-accent/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : "w-full justify-start gap-2",
        className,
      )}
      onClick={toggleDarkMode}
      aria-label={computedAriaLabel}
    >
      {isDarkMode ? (
        <Moon className={iconSizeClass} aria-hidden="true" />
      ) : (
        <Sun className={iconSizeClass} aria-hidden="true" />
      )}
      {!isIconDisplay && (
        <span>{isDarkMode ? "Dark Mode" : "Light Mode"}</span>
      )}
    </Button>
  )
}
