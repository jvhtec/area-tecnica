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
import { registerNavigationShortcuts } from '@/lib/shortcuts/navigation-shortcuts';
import { registerJobCardShortcuts } from '@/lib/shortcuts/job-card-shortcuts';
import { registerGlobalShortcuts } from '@/lib/shortcuts/global-shortcuts';
import { initializeStreamDeck, getStreamDeckClient } from '@/lib/streamdeck/websocket-server';
import { useShortcutStore } from '@/stores/useShortcutStore';

export function useShortcutInitialization() {
  const navigate = useNavigate();
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initialized.current) return;
    initialized.current = true;

    console.log('🚀 Initializing shortcut system...');

    // Register all shortcuts
    registerNavigationShortcuts(navigate);
    registerJobCardShortcuts();
    registerGlobalShortcuts();

    // Initialize Stream Deck connection
    const streamDeckClient = initializeStreamDeck();

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

    // Capture phase to intercept before browser default handlers
    window.addEventListener('keydown', handleKeyDown, true);

    // Listen for navigation events from Stream Deck
    const handleStreamDeckNavigate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const route = customEvent.detail?.route;
      if (route) {
        navigate(route);
      }
    };

    window.addEventListener('streamdeck-navigate', handleStreamDeckNavigate);

    console.log('✅ Shortcut system initialized');

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('streamdeck-navigate', handleStreamDeckNavigate);
      streamDeckClient.disconnect();
    };
  }, [navigate]);
}

/**
 * Build a keybind string from a keyboard event
 */
function buildKeybind(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  // Handle special keys
  let key = e.key;
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
