
type EventCallback<T = any> = (data: T) => void;

/**
 * Simple event emitter with typed events
 */
export class EventEmitter<Events extends Record<string, any>> {
  private events: { [K in keyof Events]?: Array<EventCallback<Events[K]>> } = {};
  private cleanupCallbacks: Array<() => void> = [];

  /**
   * Register an event listener
   * @param event Event name
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  public on<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event]!.push(callback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Register a one-time event listener
   * @param event Event name
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  public once<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
    const onceCallback = (data: Events[K]) => {
      callback(data);
      this.off(event, onceCallback as EventCallback<Events[K]>);
    };

    return this.on(event, onceCallback as EventCallback<Events[K]>);
  }

  /**
   * Remove an event listener
   * @param event Event name
   * @param callback Callback function to remove
   */
  public off<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): void {
    if (!this.events[event]) {
      return;
    }

    const idx = this.events[event]!.indexOf(callback);
    if (idx !== -1) {
      this.events[event]!.splice(idx, 1);
    }
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Event data
   */
  public emit<K extends keyof Events>(event: K, data?: Events[K]): void {
    if (!this.events[event]) {
      return;
    }

    // Create a copy to avoid issues if handlers modify the array
    const callbacks = [...this.events[event]!];
    for (const callback of callbacks) {
      try {
        callback(data as Events[K]);
      } catch (error) {
        console.error(`Error in event listener for "${String(event)}":`, error);
      }
    }
  }

  /**
   * Add a callback to be executed during cleanup
   * @param callback Cleanup callback
   */
  protected addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Execute all registered cleanup callbacks
   */
  protected executeCleanupCallbacks(): void {
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error("Error in cleanup callback:", error);
      }
    }
    this.cleanupCallbacks = [];
  }

  /**
   * Remove all event listeners
   */
  public removeAllListeners(): void {
    this.events = {};
  }

  /**
   * Get all registered event names
   */
  public getEventNames(): Array<keyof Events> {
    return Object.keys(this.events) as Array<keyof Events>;
  }
}
