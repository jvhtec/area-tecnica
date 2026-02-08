import React, { createContext, useContext } from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface UserPreferencesContextType {
  preferences: {
    dark_mode: boolean;
    time_span: string;
    last_activity: string;
    custom_folder_structure: any;
    custom_tour_folder_structure: any;
  } | null;
  isLoading: boolean;
  updatePreferences: (newPreferences: Partial<{
    dark_mode: boolean;
    time_span: string;
    last_activity: string;
    custom_folder_structure: any;
    custom_tour_folder_structure: any;
  }>) => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

/**
 * UserPreferencesProvider - Singleton provider for user preferences
 *
 * Runs useUserPreferences() exactly once at the app level to ensure:
 * - Theme preference loads and applies once
 * - Inactivity monitoring runs once
 * - Event listeners (click, keydown, online/offline) register once
 * - Database preference updates are not duplicated
 *
 * This prevents multiple components from running the same side effects,
 * which would cause duplicate intervals, event listeners, and database writes.
 */
export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  // Run all preference side effects here (loading, intervals, listeners, etc.)
  const preferences = useUserPreferences();

  return (
    <UserPreferencesContext.Provider value={preferences}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

/**
 * useUserPreferencesValue - Hook to access cached preferences from context
 *
 * Use this in components that only need to READ the preferences value,
 * without triggering additional side effects.
 * The side effects (inactivity monitoring, theme loading) run only once
 * via UserPreferencesProvider at the app level.
 *
 * @example
 * // In ThemeToggle or any component
 * const { preferences, updatePreferences } = useUserPreferencesValue();
 */
export function useUserPreferencesValue() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      'useUserPreferencesValue must be used within UserPreferencesProvider'
    );
  }
  return context;
}
