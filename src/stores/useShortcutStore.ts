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
          newShortcuts.set(shortcut.id, {
            ...shortcut,
            enabled: true,
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
        if (!shortcut || !shortcut.enabled) {
          console.warn(`Shortcut ${id} not found or disabled`);
          return false;
        }

        try {
          await shortcut.action();
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
    }
  )
);
