/**
 * Navigation Shortcuts
 *
 * Registers shortcuts for navigating to different pages in the app.
 * Used by Stream Deck and keyboard shortcuts.
 */

import { useShortcutStore } from '@/stores/useShortcutStore';
import { NavigateFunction } from 'react-router-dom';
import { navigationShortcuts } from '@/routes/app-route-manifest';

export interface NavigationShortcut {
  id: string;
  label: string;
  route: string;
  keybind?: string;
  icon?: string;
  requiredRoles?: string[];
}

export const NAVIGATION_SHORTCUTS: NavigationShortcut[] = navigationShortcuts;

/**
 * Register navigation shortcuts with the shortcut store.
 * Call this on app initialization.
 */
export function registerNavigationShortcuts(navigate: NavigateFunction) {
  const shortcutStore = useShortcutStore.getState();

  NAVIGATION_SHORTCUTS.forEach((navShortcut) => {
    shortcutStore.registerShortcut({
      id: navShortcut.id,
      category: 'navigation',
      label: navShortcut.label,
      description: `Navegar a ${navShortcut.label}`,
      defaultKeybind: navShortcut.keybind,
      action: () => {
        console.log(`[Navigation] Executing shortcut: ${navShortcut.id} → ${navShortcut.route}`);
        navigate(navShortcut.route);
      },
    });
  });

  console.log(`✅ Registered ${NAVIGATION_SHORTCUTS.length} navigation shortcuts`);
}

/**
 * Get navigation shortcuts filtered by user role
 */
export function getNavigationShortcutsForRole(userRole: string): NavigationShortcut[] {
  return NAVIGATION_SHORTCUTS.filter((shortcut) => {
    if (!shortcut.requiredRoles || shortcut.requiredRoles.length === 0) {
      return true;
    }
    return shortcut.requiredRoles.includes(userRole);
  });
}
