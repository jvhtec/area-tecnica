/**
 * Navigation Shortcuts
 *
 * Registers shortcuts for navigating to different pages in the app.
 * Used by Stream Deck and keyboard shortcuts.
 */

import { useShortcutStore } from '@/stores/useShortcutStore';
import { NavigateFunction } from 'react-router-dom';

export interface NavigationShortcut {
  id: string;
  label: string;
  route: string;
  keybind?: string;
  icon?: string;
  requiredRoles?: string[];
}

// Define all navigation shortcuts based on the routes from App.tsx
export const NAVIGATION_SHORTCUTS: NavigationShortcut[] = [
  {
    id: 'nav-dashboard',
    label: 'Panel Principal',
    route: '/dashboard',
    keybind: 'Ctrl+1',
    icon: 'LayoutDashboard',
    requiredRoles: ['admin', 'management', 'logistics'],
  },
  {
    id: 'nav-technician-dashboard',
    label: 'Panel Técnico',
    route: '/technician-dashboard',
    keybind: 'Ctrl+Shift+1',
    icon: 'Wrench',
    requiredRoles: ['house_tech'],
  },
  {
    id: 'nav-sound',
    label: 'Sonido',
    route: '/sound',
    keybind: 'Ctrl+2',
    icon: 'Volume2',
    requiredRoles: ['admin', 'management', 'house_tech'],
  },
  {
    id: 'nav-lights',
    label: 'Luces',
    route: '/lights',
    keybind: 'Ctrl+3',
    icon: 'Lightbulb',
    requiredRoles: ['admin', 'management', 'house_tech'],
  },
  {
    id: 'nav-video',
    label: 'Video',
    route: '/video',
    keybind: 'Ctrl+4',
    icon: 'Video',
    requiredRoles: ['admin', 'management', 'house_tech'],
  },
  {
    id: 'nav-logistics',
    label: 'Logística',
    route: '/logistics',
    keybind: 'Ctrl+5',
    icon: 'Truck',
    requiredRoles: ['admin', 'management', 'logistics', 'house_tech'],
  },
  {
    id: 'nav-tours',
    label: 'Tours',
    route: '/tours',
    keybind: 'Ctrl+6',
    icon: 'Plane',
    requiredRoles: ['admin', 'management', 'house_tech'],
  },
  {
    id: 'nav-festivals',
    label: 'Festivales',
    route: '/festivals',
    keybind: 'Ctrl+7',
    icon: 'Music',
    requiredRoles: ['admin', 'management', 'house_tech'],
  },
  {
    id: 'nav-personal',
    label: 'Personal',
    route: '/personal',
    keybind: 'Ctrl+8',
    icon: 'Users',
    requiredRoles: ['admin', 'management', 'logistics', 'house_tech'],
  },
  {
    id: 'nav-project-management',
    label: 'Gestión de Proyectos',
    route: '/project-management',
    keybind: 'Ctrl+9',
    icon: 'FolderKanban',
    requiredRoles: ['admin', 'management', 'logistics'],
  },
  {
    id: 'nav-job-assignment-matrix',
    label: 'Matriz de Asignaciones',
    route: '/job-assignment-matrix',
    keybind: 'Ctrl+0',
    icon: 'Calendar',
    requiredRoles: ['admin', 'management'],
  },
  {
    id: 'nav-rates',
    label: 'Tarifas',
    route: '/management/rates',
    keybind: 'Ctrl+Shift+R',
    icon: 'DollarSign',
    requiredRoles: ['admin', 'management'],
  },
  {
    id: 'nav-expenses',
    label: 'Gastos',
    route: '/gastos',
    keybind: 'Ctrl+Shift+G',
    icon: 'Receipt',
    requiredRoles: ['admin', 'management', 'logistics'],
  },
  {
    id: 'nav-timesheets',
    label: 'Hojas de Tiempo',
    route: '/timesheets',
    keybind: 'Ctrl+Shift+T',
    icon: 'Clock',
  },
  {
    id: 'nav-tech-app',
    label: 'App Técnico',
    route: '/tech-app',
    icon: 'Smartphone',
    requiredRoles: ['technician'],
  },
  {
    id: 'nav-hoja-de-ruta',
    label: 'Hoja de Ruta',
    route: '/hoja-de-ruta',
    keybind: 'Ctrl+Shift+H',
    icon: 'Map',
    requiredRoles: ['admin', 'management', 'house_tech'],
  },
  {
    id: 'nav-profile',
    label: 'Perfil',
    route: '/profile',
    keybind: 'Ctrl+Shift+P',
    icon: 'User',
  },
  {
    id: 'nav-settings',
    label: 'Configuración',
    route: '/settings',
    keybind: 'Ctrl+,',
    icon: 'Settings',
    requiredRoles: ['admin', 'management'],
  },
];

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
