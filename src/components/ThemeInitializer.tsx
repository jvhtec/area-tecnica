import { useUserPreferences } from '@/hooks/useUserPreferences';

/**
 * ThemeInitializer - Non-rendering component that initializes user theme preferences
 *
 * Loads dark_mode preference from database and applies the "dark" class to document.documentElement
 * This ensures light/dark mode works correctly on all authenticated pages, including those
 * outside the Layout component (e.g., Achievements page)
 *
 * The useUserPreferences hook handles:
 * - Loading preference from Supabase profiles table
 * - Applying CSS class to DOM
 * - localStorage persistence
 * - Database sync
 */
export function ThemeInitializer() {
  // Load and apply theme preferences
  useUserPreferences();

  // Non-rendering component
  return null;
}
