/**
 * WebSocket Server for Stream Deck Integration
 *
 * This module sets up a WebSocket connection to communicate with Stream Deck.
 * Since we're running in a browser, we'll use a WebSocket client that connects
 * to a local WebSocket server (which you'll need to run separately).
 *
 * Messages sent TO Stream Deck:
 * - Current page/route
 * - Selected job card info
 * - Selected matrix cell info
 * - Button state updates
 *
 * Messages received FROM Stream Deck:
 * - Execute shortcut by ID
 * - Navigate to route
 * - Trigger job card action
 */

import { useShortcutStore } from '@/stores/useShortcutStore';
import { useSelectedJobStore } from '@/stores/useSelectedJobStore';
import { useSelectedCellStore } from '@/stores/useSelectedCellStore';

export interface StreamDeckMessage {
  type: 'execute-shortcut' | 'navigate' | 'get-state' | 'ping';
  payload?: any;
}

export interface StreamDeckStateUpdate {
  type: 'state-update';
  payload: {
    currentRoute: string;
    selectedJob: any | null;
    selectedCell: any | null;
    availableShortcuts: string[];
  };
}

export class StreamDeckWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private url: string;
  private isConnected = false;

  constructor(url: string = 'ws://localhost:3001') {
    this.url = url;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ Stream Deck WebSocket connected');
        this.isConnected = true;
        this.clearReconnectTimer();
        this.sendStateUpdate();
      };

      this.ws.onclose = () => {
        console.log('❌ Stream Deck WebSocket disconnected');
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Stream Deck WebSocket error:', error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      console.log('🔄 Attempting to reconnect to Stream Deck...');
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleMessage(data: string) {
    try {
      const message: StreamDeckMessage = JSON.parse(data);

      switch (message.type) {
        case 'execute-shortcut':
          this.handleExecuteShortcut(message.payload?.shortcutId);
          break;

        case 'navigate':
          this.handleNavigate(message.payload?.route);
          break;

        case 'get-state':
          this.sendStateUpdate();
          break;

        case 'ping':
          this.send({ type: 'pong' });
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse Stream Deck message:', error);
    }
  }

  private handleExecuteShortcut(shortcutId: string) {
    if (!shortcutId) {
      console.error('No shortcut ID provided');
      return;
    }

    const shortcutStore = useShortcutStore.getState();
    shortcutStore.executeShortcut(shortcutId);
  }

  private handleNavigate(route: string) {
    if (!route) {
      console.error('No route provided');
      return;
    }

    // Dispatch navigation event
    window.dispatchEvent(
      new CustomEvent('streamdeck-navigate', {
        detail: { route },
      })
    );
  }

  private send(data: any) {
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public sendStateUpdate() {
    const shortcutStore = useShortcutStore.getState();
    const selectedJobStore = useSelectedJobStore.getState();
    const selectedCellStore = useSelectedCellStore.getState();

    const state: StreamDeckStateUpdate = {
      type: 'state-update',
      payload: {
        currentRoute: window.location.pathname,
        selectedJob: selectedJobStore.selectedJob,
        selectedCell: selectedCellStore.selectedCell,
        availableShortcuts: shortcutStore
          .getAllShortcuts()
          .filter((s) => s.enabled)
          .map((s) => s.id),
      },
    };

    this.send(state);
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let streamDeckClient: StreamDeckWebSocketClient | null = null;

export function getStreamDeckClient(): StreamDeckWebSocketClient {
  if (!streamDeckClient) {
    streamDeckClient = new StreamDeckWebSocketClient();
  }
  return streamDeckClient;
}

export function initializeStreamDeck() {
  const client = getStreamDeckClient();
  client.connect();

  // Send state updates when things change
  window.addEventListener('job-selected', () => {
    client.sendStateUpdate();
  });

  window.addEventListener('job-deselected', () => {
    client.sendStateUpdate();
  });

  // Listen for route changes
  window.addEventListener('popstate', () => {
    client.sendStateUpdate();
  });

  return client;
}
