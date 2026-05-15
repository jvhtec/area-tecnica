/**
 * Global Shortcuts
 *
 * Shortcuts that work from anywhere in the app, regardless of current route or context.
 */

import { useShortcutStore } from '@/stores/useShortcutStore';
import { useCreateJobDialogStore } from '@/stores/useCreateJobDialogStore';

export interface GlobalShortcut {
  id: string;
  label: string;
  description: string;
  keybind?: string;
  icon?: string;
  action: () => void | Promise<void>;
}

/**
 * Global shortcut definitions
 */
export const GLOBAL_SHORTCUTS: Omit<GlobalShortcut, 'action'>[] = [
  {
    id: 'global-create-job',
    label: 'Crear Trabajo',
    description: 'Abrir diálogo de creación de trabajo',
    keybind: 'Ctrl+N',
    icon: 'Plus',
  },
  {
    id: 'global-refresh',
    label: 'Refrescar Página',
    description: 'Recargar la página actual',
    keybind: 'Ctrl+Shift+R',
    icon: 'RefreshCw',
  },
];

/**
 * Register global shortcuts with the shortcut store
 */
export function registerGlobalShortcuts() {
  const shortcutStore = useShortcutStore.getState();

  // Create Job shortcut
  shortcutStore.registerShortcut({
    id: 'global-create-job',
    category: 'global',
    label: 'Crear Trabajo',
    description: 'Abrir diálogo de creación de trabajo (funciona desde cualquier página)',
    defaultKeybind: 'Ctrl+N',
    action: () => {
      const createJobStore = useCreateJobDialogStore.getState();
      createJobStore.openDialog();
    },
  });

  // Refresh shortcut
  shortcutStore.registerShortcut({
    id: 'global-refresh',
    category: 'global',
    label: 'Refrescar Página',
    description: 'Recargar la página actual',
    defaultKeybind: 'Ctrl+Shift+R',
    action: () => {
      window.location.reload();
    },
  });

  console.log(`✅ Registered ${GLOBAL_SHORTCUTS.length} global shortcuts`);
}
