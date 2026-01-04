import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global shortcut registry for Stream Deck and keyboard shortcuts.
 *
 * Shortcuts are organized by category:
 * - navigation: Page/route navigation
 * - job-card: Job card actions
 * - matrix: Matrix cell actions
 * - global: Global app actions
 */

export type ShortcutCategory = 'navigation' | 'job-card' | 'matrix' | 'global';

export interface ShortcutDefinition {
  id: string;
  category: ShortcutCategory;
  label: string;
  description?: string;
  defaultKeybind?: string;
  customKeybind?: string;
  action: () => void | Promise<void>;
  enabled: boolean;
  requiresSelection?: boolean; // e.g., job card must be selected
}

interface ShortcutStore {
  // Registry of all shortcuts
  shortcuts: Map<string, ShortcutDefinition>;

  // Actions
  registerShortcut: (shortcut: Omit<ShortcutDefinition, 'enabled'>) => void;
  unregisterShortcut: (id: string) => void;
  executeShortcut: (id: string) => Promise<boolean>;
  updateKeybind: (id: string, keybind: string) => void;
  enableShortcut: (id: string) => void;
  disableShortcut: (id: string) => void;
  getShortcut: (id: string) => ShortcutDefinition | undefined;
  getShortcutsByCategory: (category: ShortcutCategory) => ShortcutDefinition[];
  getAllShortcuts: () => ShortcutDefinition[];

  // Export/Import for settings
  exportConfig: () => Record<string, { customKeybind?: string; enabled: boolean }>;
  importConfig: (config: Record<string, { customKeybind?: string; enabled: boolean }>) => void;
}

export const useShortcutStore = create<ShortcutStore>()(
  persist(
    (set, get) => ({
      shortcuts: new Map(),

      registerShortcut: (shortcut) => {
        set((state) => {
          const newShortcuts = new Map(state.shortcuts);
          const existingShortcut = newShortcuts.get(shortcut.id);
          newShortcuts.set(shortcut.id, {
            ...shortcut,
            // Preserve enabled state if shortcut already exists
            enabled: existingShortcut?.enabled ?? true,
            // Preserve custom keybind if it exists
            customKeybind: existingShortcut?.customKeybind ?? shortcut.customKeybind,
          });
          return { shortcuts: newShortcuts };
        });
      },

      unregisterShortcut: (id) => {
        set((state) => {
          const newShortcuts = new Map(state.shortcuts);
          newShortcuts.delete(id);
          return { shortcuts: newShortcuts };
        });
      },

      executeShortcut: async (id) => {
        const shortcut = get().shortcuts.get(id);
        console.log(`[ShortcutStore] Executing shortcut: ${id}`, {
          found: !!shortcut,
          enabled: shortcut?.enabled,
          hasAction: !!shortcut?.action,
          category: shortcut?.category
        });

        if (!shortcut || !shortcut.enabled) {
          console.warn(`Shortcut ${id} not found or disabled`);
          return false;
        }

        if (!shortcut.action) {
          console.error(`Shortcut ${id} has no action function!`);
          return false;
        }

        try {
          await shortcut.action();
          console.log(`[ShortcutStore] Successfully executed: ${id}`);
          return true;
        } catch (error) {
          console.error(`Failed to execute shortcut ${id}:`, error);
          return false;
        }
      },

      updateKeybind: (id, keybind) => {
        set((state) => {
          const newShortcuts = new Map(state.shortcuts);
          const shortcut = newShortcuts.get(id);
          if (shortcut) {
            newShortcuts.set(id, { ...shortcut, customKeybind: keybind });
          }
          return { shortcuts: newShortcuts };
        });
      },

      enableShortcut: (id) => {
        set((state) => {
          const newShortcuts = new Map(state.shortcuts);
          const shortcut = newShortcuts.get(id);
          if (shortcut) {
            newShortcuts.set(id, { ...shortcut, enabled: true });
          }
          return { shortcuts: newShortcuts };
        });
      },

      disableShortcut: (id) => {
        set((state) => {
          const newShortcuts = new Map(state.shortcuts);
          const shortcut = newShortcuts.get(id);
          if (shortcut) {
            newShortcuts.set(id, { ...shortcut, enabled: false });
          }
          return { shortcuts: newShortcuts };
        });
      },

      getShortcut: (id) => {
        return get().shortcuts.get(id);
      },

      getShortcutsByCategory: (category) => {
        return Array.from(get().shortcuts.values()).filter(
          (s) => s.category === category
        );
      },

      getAllShortcuts: () => {
        return Array.from(get().shortcuts.values());
      },

      exportConfig: () => {
        const shortcuts = get().shortcuts;
        const config: Record<string, { customKeybind?: string; enabled: boolean }> = {};

        shortcuts.forEach((shortcut, id) => {
          config[id] = {
            customKeybind: shortcut.customKeybind,
            enabled: shortcut.enabled,
          };
        });

        return config;
      },

      importConfig: (config) => {
        set((state) => {
          const newShortcuts = new Map(state.shortcuts);

          Object.entries(config).forEach(([id, settings]) => {
            const shortcut = newShortcuts.get(id);
            if (shortcut) {
              newShortcuts.set(id, {
                ...shortcut,
                customKeybind: settings.customKeybind,
                enabled: settings.enabled,
              });
            }
          });

          return { shortcuts: newShortcuts };
        });
      },
    }),
    {
      name: 'shortcut-config',
      // Only persist configuration, not the action functions
      partialize: (state) => ({
        shortcuts: Array.from(state.shortcuts.entries()).map(([id, shortcut]) => [
          id,
          {
            id: shortcut.id,
            category: shortcut.category,
            label: shortcut.label,
            description: shortcut.description,
            defaultKeybind: shortcut.defaultKeybind,
            customKeybind: shortcut.customKeybind,
            enabled: shortcut.enabled,
            requiresSelection: shortcut.requiresSelection,
            // Don't persist the action function
          },
        ]),
      }),
      // Custom merge to properly restore Map from persisted array
      merge: (persistedState: any, currentState: ShortcutStore) => {
        console.log('[ShortcutStore] Rehydrating from localStorage...');

        // If no persisted state, return current state
        if (!persistedState || !persistedState.shortcuts) {
          console.log('[ShortcutStore] No persisted state, using empty Map');
          return currentState;
        }

        // Convert persisted array back to Map
        const restoredMap = new Map();

        if (Array.isArray(persistedState.shortcuts)) {
          persistedState.shortcuts.forEach(([id, config]: [string, any]) => {
            // Store config without action (action will be added during registration)
            restoredMap.set(id, config);
          });
          console.log(`[ShortcutStore] Restored ${restoredMap.size} shortcuts from localStorage`);
        }

        return {
          ...currentState,
          shortcuts: restoredMap,
        };
      },
    }
  )
);
