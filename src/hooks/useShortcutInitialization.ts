/**
 * Initialize the global shortcut system
 *
 * This hook should be called once in the App component to:
 * 1. Register all navigation shortcuts
 * 2. Register all job card action shortcuts
 * 3. Initialize the Stream Deck WebSocket connection
 * 4. Set up keyboard event listeners
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

type StreamDeckClient = ReturnType<
  typeof import('@/lib/streamdeck/websocket-server').initializeStreamDeck
>;

export function useShortcutInitialization() {
  const navigate = useNavigate();
  const initialized = useRef(false);
  const navigateRef = useRef(navigate);

  // Keep navigate ref up to date
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    // Only initialize once
    if (initialized.current) {
      console.log('⚠️ Shortcut system already initialized, skipping');
      return;
    }
    initialized.current = true;

    console.log('🚀 Initializing shortcut system...');

    let streamDeckClient: StreamDeckClient | null = null;
    let cleanup: (() => void) | null = null;
    let disposed = false;

    const setupShortcuts = async () => {
      try {
        const [
          { registerNavigationShortcuts },
          { registerJobCardShortcuts },
          { registerGlobalShortcuts },
          { initializeStreamDeck },
          { useShortcutStore },
        ] = await Promise.all([
          import('@/lib/shortcuts/navigation-shortcuts'),
          import('@/lib/shortcuts/job-card-shortcuts'),
          import('@/lib/shortcuts/global-shortcuts'),
          import('@/lib/streamdeck/websocket-server'),
          import('@/stores/useShortcutStore'),
        ]);

        if (disposed) {
          return;
        }

        // Register all shortcuts using current navigate
        registerNavigationShortcuts(navigateRef.current);
        registerJobCardShortcuts();
        registerGlobalShortcuts();

        // Initialize Stream Deck connection
        streamDeckClient = initializeStreamDeck();

        // Set up keyboard event listener for shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore if user is typing in an input/textarea
          const target = e.target as HTMLElement;
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
          ) {
            return;
          }

          const shortcutStore = useShortcutStore.getState();
          const shortcuts = shortcutStore.getAllShortcuts();

          // Check if any shortcut matches the key combination
          const keybind = buildKeybind(e);

          for (const shortcut of shortcuts) {
            const targetKeybind = shortcut.customKeybind || shortcut.defaultKeybind;
            if (targetKeybind && normalizeKeybind(targetKeybind) === normalizeKeybind(keybind)) {
              if (shortcut.enabled) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                shortcutStore.executeShortcut(shortcut.id);
              }
              break;
            }
          }
        };

        // Listen for navigation events from Stream Deck
        const handleStreamDeckNavigate = (event: Event) => {
          console.log('[ShortcutInit] Received streamdeck-navigate event:', event);
          const customEvent = event as CustomEvent;
          const route = customEvent.detail?.route;
          console.log('[ShortcutInit] Navigating to route:', route);
          if (route) {
            // Use the ref to get current navigate function
            navigateRef.current(route);
            console.log('[ShortcutInit] Navigation called');
          } else {
            console.warn('[ShortcutInit] No route in event detail');
          }
        };

        // Capture phase to intercept before browser default handlers
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('streamdeck-navigate', handleStreamDeckNavigate);

        cleanup = () => {
          window.removeEventListener('keydown', handleKeyDown, true);
          window.removeEventListener('streamdeck-navigate', handleStreamDeckNavigate);
          streamDeckClient?.disconnect();
        };

        console.log('✅ Shortcut system initialized');
        console.log('✅ Event listener registered for streamdeck-navigate');
      } catch (error) {
        console.error('Failed to initialize shortcut system:', error);
      }
    };

    void setupShortcuts();

    return () => {
      disposed = true;
      console.log('🧹 Cleaning up shortcut system (this should only happen on unmount)');
      cleanup?.();
    };
  }, []); // Empty deps - only run once on mount
}

/**
 * Build a keybind string from a keyboard event
 */
function buildKeybind(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  // Handle special keys (guard against synthetic events without key property)
  let key = e.key ?? '';
  if (key === ' ') key = 'Space';
  if (key === 'Delete') key = 'Delete';
  if (key === 'Escape') key = 'Escape';
  if (key === 'Enter') key = 'Enter';
  if (key === 'Tab') key = 'Tab';

  // Normalize letter keys to uppercase
  if (key.length === 1) {
    key = key.toUpperCase();
  }

  parts.push(key);

  return parts.join('+');
}

/**
 * Normalize a keybind string for comparison
 */
function normalizeKeybind(keybind: string): string {
  const parts = keybind.split('+').map((p) => p.trim());

  // Sort modifiers in consistent order
  const modifiers: string[] = [];
  const keys: string[] = [];

  for (const part of parts) {
    if (part === 'Ctrl' || part === 'Control' || part === 'Cmd' || part === 'Meta') {
      modifiers.push('Ctrl');
    } else if (part === 'Shift') {
      modifiers.push('Shift');
    } else if (part === 'Alt' || part === 'Option') {
      modifiers.push('Alt');
    } else {
      keys.push(part.toUpperCase());
    }
  }

  // Remove duplicates and sort
  const uniqueModifiers = [...new Set(modifiers)].sort();

  return [...uniqueModifiers, ...keys].join('+');
}
