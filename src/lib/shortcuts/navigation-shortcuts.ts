/**
 * Navigation Shortcuts
 *
 * Registers shortcuts for navigating to different pages in the app.
 * Used by Stream Deck and keyboard shortcuts.
 */

import { useShortcutStore } from '@/stores/useShortcutStore';
import { NavigateFunction } from 'react-router-dom';
import { navigationShortcuts, type AccessPolicyId } from '@/routes/app-route-manifest';
import { isManagementRole } from '@/utils/permissions';

export interface NavigationShortcut {
  id: string;
  label: string;
  route: string;
  keybind?: string;
  icon?: string;
  access?: AccessPolicyId;
  requiredRoles?: readonly string[];
  allowAssignableTech?: boolean;
}

export interface NavigationShortcutContext {
  userRole: string | null | undefined;
  assignableAsTech?: boolean | null;
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
export function getNavigationShortcutsForRole(
  userRoleOrContext: string | NavigationShortcutContext,
): NavigationShortcut[] {
  const context =
    typeof userRoleOrContext === 'string'
      ? { userRole: userRoleOrContext, assignableAsTech: false }
      : userRoleOrContext;

  return NAVIGATION_SHORTCUTS.filter((shortcut) => {
    if (!shortcut.requiredRoles || shortcut.requiredRoles.length === 0) {
      return true;
    }

    if (context.userRole && shortcut.requiredRoles.includes(context.userRole)) {
      return true;
    }

    return (
      shortcut.allowAssignableTech === true &&
      context.assignableAsTech === true &&
      isManagementRole(context.userRole)
    );
  });
}
