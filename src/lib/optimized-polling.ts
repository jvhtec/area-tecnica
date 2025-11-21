/**
 * Optimized Polling Manager
 *
 * Intelligent polling system that:
 * - Reduces polling frequency when app is in background
 * - Uses requestIdleCallback for non-critical updates
 * - Batches multiple polling requests
 * - Respects data saver mode
 * - Coordinates across tabs to prevent duplicate requests
 */

type PollingCallback = () => Promise<void> | void;

interface PollingConfig {
  /** Polling interval in ms when app is active */
  activeInterval: number;
  /** Polling interval in ms when app is in background */
  backgroundInterval: number;
  /** Whether to use requestIdleCallback */
  useIdleCallback: boolean;
  /** Whether to pause when tab is hidden */
  pauseWhenHidden: boolean;
  /** Callback to execute */
  callback: PollingCallback;
  /** Whether to run immediately on start */
  immediate?: boolean;
  /** Name for debugging */
  name?: string;
}

interface PollingInstance {
  id: string;
  config: PollingConfig;
  intervalId: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
  lastRun: number;
}

// ============================================
// POLLING MANAGER CLASS
// ============================================

class OptimizedPollingManager {
  private static instance: OptimizedPollingManager;
  private pollers: Map<string, PollingInstance> = new Map();
  private isVisible: boolean = true;
  private isOnline: boolean = true;
  private isLeaderTab: boolean = true;
  private saveDataMode: boolean = false;

  private constructor() {
    this.setupVisibilityListener();
    this.setupNetworkListener();
    this.setupLeaderElection();
    this.checkDataSaverMode();
  }

  static getInstance(): OptimizedPollingManager {
    if (!OptimizedPollingManager.instance) {
      OptimizedPollingManager.instance = new OptimizedPollingManager();
    }
    return OptimizedPollingManager.instance;
  }

  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      this.isVisible = document.visibilityState === 'visible';
      this.updateAllPollers();
    });
  }

  private setupNetworkListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateAllPollers();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.pauseAllPollers();
    });
  }

  private setupLeaderElection(): void {
    // Simple leader election using localStorage
    const channel = new BroadcastChannel('polling-leader');
    const tabId = Math.random().toString(36).substr(2, 9);

    const checkLeadership = () => {
      const currentLeader = localStorage.getItem('polling-leader');
      const leaderTimestamp = parseInt(localStorage.getItem('polling-leader-timestamp') || '0', 10);

      // Claim leadership if no leader or leader is stale (> 10s)
      if (!currentLeader || Date.now() - leaderTimestamp > 10000) {
        localStorage.setItem('polling-leader', tabId);
        localStorage.setItem('polling-leader-timestamp', Date.now().toString());
        this.isLeaderTab = true;
      } else {
        this.isLeaderTab = currentLeader === tabId;
      }
    };

    // Check leadership periodically
    checkLeadership();
    setInterval(checkLeadership, 5000);

    // Listen for leadership changes
    channel.onmessage = () => {
      checkLeadership();
      this.updateAllPollers();
    };

    // Release leadership on unload
    window.addEventListener('beforeunload', () => {
      if (this.isLeaderTab) {
        localStorage.removeItem('polling-leader');
        channel.postMessage({ type: 'leader-released' });
      }
    });
  }

  private checkDataSaverMode(): void {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    this.saveDataMode = connection?.saveData || false;

    if (connection) {
      (connection as EventTarget).addEventListener('change', () => {
        this.saveDataMode = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData || false;
        this.updateAllPollers();
      });
    }
  }

  private getEffectiveInterval(config: PollingConfig): number {
    // Double interval in data saver mode
    const baseInterval = this.isVisible ? config.activeInterval : config.backgroundInterval;
    return this.saveDataMode ? baseInterval * 2 : baseInterval;
  }

  private shouldPoll(poller: PollingInstance): boolean {
    // Don't poll if offline
    if (!this.isOnline) return false;

    // Don't poll if not leader tab (prevents duplicate requests)
    if (!this.isLeaderTab) return false;

    // Don't poll if hidden and pauseWhenHidden is true
    if (!this.isVisible && poller.config.pauseWhenHidden) return false;

    return true;
  }

  private executeCallback(poller: PollingInstance): void {
    if (!this.shouldPoll(poller)) return;

    const execute = () => {
      poller.lastRun = Date.now();
      Promise.resolve(poller.config.callback()).catch((error) => {
        console.error(`[Polling] Error in ${poller.config.name || poller.id}:`, error);
      });
    };

    if (poller.config.useIdleCallback && 'requestIdleCallback' in window) {
      window.requestIdleCallback(execute, { timeout: 5000 });
    } else {
      execute();
    }
  }

  private startPoller(poller: PollingInstance): void {
    if (poller.intervalId) {
      clearInterval(poller.intervalId);
    }

    const interval = this.getEffectiveInterval(poller.config);
    poller.intervalId = setInterval(() => this.executeCallback(poller), interval);
    poller.isRunning = true;

    // Run immediately if configured
    if (poller.config.immediate && this.shouldPoll(poller)) {
      this.executeCallback(poller);
    }
  }

  private stopPoller(poller: PollingInstance): void {
    if (poller.intervalId) {
      clearInterval(poller.intervalId);
      poller.intervalId = null;
    }
    poller.isRunning = false;
  }

  private updateAllPollers(): void {
    this.pollers.forEach((poller) => {
      if (this.shouldPoll(poller)) {
        // Restart with new interval
        this.startPoller(poller);
      } else {
        this.stopPoller(poller);
      }
    });
  }

  private pauseAllPollers(): void {
    this.pollers.forEach((poller) => this.stopPoller(poller));
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Register a new polling task
   */
  register(id: string, config: PollingConfig): void {
    // Stop existing poller if any
    this.unregister(id);

    const poller: PollingInstance = {
      id,
      config,
      intervalId: null,
      isRunning: false,
      lastRun: 0,
    };

    this.pollers.set(id, poller);

    if (this.shouldPoll(poller)) {
      this.startPoller(poller);
    }
  }

  /**
   * Unregister a polling task
   */
  unregister(id: string): void {
    const poller = this.pollers.get(id);
    if (poller) {
      this.stopPoller(poller);
      this.pollers.delete(id);
    }
  }

  /**
   * Pause a specific poller
   */
  pause(id: string): void {
    const poller = this.pollers.get(id);
    if (poller) {
      this.stopPoller(poller);
    }
  }

  /**
   * Resume a specific poller
   */
  resume(id: string): void {
    const poller = this.pollers.get(id);
    if (poller && this.shouldPoll(poller)) {
      this.startPoller(poller);
    }
  }

  /**
   * Force immediate execution of a poller
   */
  forceRun(id: string): void {
    const poller = this.pollers.get(id);
    if (poller) {
      this.executeCallback(poller);
    }
  }

  /**
   * Get status of all pollers
   */
  getStatus(): Record<string, { isRunning: boolean; lastRun: number }> {
    const status: Record<string, { isRunning: boolean; lastRun: number }> = {};
    this.pollers.forEach((poller, id) => {
      status[id] = {
        isRunning: poller.isRunning,
        lastRun: poller.lastRun,
      };
    });
    return status;
  }

  /**
   * Check if this tab is the leader
   */
  get isLeader(): boolean {
    return this.isLeaderTab;
  }
}

// Export singleton
export const pollingManager = OptimizedPollingManager.getInstance();

// ============================================
// REACT HOOK
// ============================================

import { useEffect, useRef } from 'react';

interface UsePollingOptions {
  /** Interval in ms when active (default: 60000) */
  interval?: number;
  /** Interval in ms when in background (default: 120000) */
  backgroundInterval?: number;
  /** Use requestIdleCallback (default: true) */
  useIdleCallback?: boolean;
  /** Pause when tab is hidden (default: false) */
  pauseWhenHidden?: boolean;
  /** Run immediately on mount (default: true) */
  immediate?: boolean;
  /** Only run when enabled (default: true) */
  enabled?: boolean;
  /** Name for debugging */
  name?: string;
}

/**
 * Hook for optimized polling
 */
export function useOptimizedPolling(
  callback: PollingCallback,
  options: UsePollingOptions = {}
) {
  const {
    interval = 60000,
    backgroundInterval = 120000,
    useIdleCallback = true,
    pauseWhenHidden = false,
    immediate = true,
    enabled = true,
    name,
  } = options;

  const idRef = useRef<string>(
    `polling-${name || Math.random().toString(36).substr(2, 9)}`
  );
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) {
      pollingManager.unregister(idRef.current);
      return;
    }

    pollingManager.register(idRef.current, {
      activeInterval: interval,
      backgroundInterval,
      useIdleCallback,
      pauseWhenHidden,
      immediate,
      name: name || idRef.current,
      callback: () => callbackRef.current(),
    });

    return () => {
      pollingManager.unregister(idRef.current);
    };
  }, [interval, backgroundInterval, useIdleCallback, pauseWhenHidden, immediate, enabled, name]);

  return {
    forceRefresh: () => pollingManager.forceRun(idRef.current),
    pause: () => pollingManager.pause(idRef.current),
    resume: () => pollingManager.resume(idRef.current),
  };
}

// ============================================
// SMART REFRESH UTILITIES
// ============================================

/**
 * Smart refresh that batches invalidations
 */
export class BatchedRefresher {
  private pendingRefreshes: Set<string> = new Set();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private callback: (keys: string[]) => void;
  private delay: number;

  constructor(callback: (keys: string[]) => void, delay: number = 100) {
    this.callback = callback;
    this.delay = delay;
  }

  /**
   * Queue a refresh for a specific key
   */
  queue(key: string): void {
    this.pendingRefreshes.add(key);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      const keys = Array.from(this.pendingRefreshes);
      this.pendingRefreshes.clear();
      this.callback(keys);
    }, this.delay);
  }

  /**
   * Flush pending refreshes immediately
   */
  flush(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    const keys = Array.from(this.pendingRefreshes);
    this.pendingRefreshes.clear();
    if (keys.length > 0) {
      this.callback(keys);
    }
  }
}

export default pollingManager;
