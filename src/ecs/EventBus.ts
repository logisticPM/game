/**
 * Type definition for event listeners
 */
type Listener<T> = (payload: T) => void;

/**
 * Event names for type safety
 */
export enum EventName {
  GameStateChanged = 'gameStateChanged',
  BidRequest = 'bidRequest',
  PlayCardsRequest = 'playCardsRequest',
  PlayCardsValidated = 'playCardsValidated',
  PassTurnRequest = 'passTurnRequest',
  SelectCardRequest = 'selectCardRequest',
  InvalidPlay = 'invalidPlay',
  CardSelected = 'cardSelected',
  GameReset = 'gameReset'
}

/**
 * EventBus for handling game events
 */
export class EventBus {
  private events: Map<string, Listener<any>[]> = new Map();
  private debugMode: boolean = false;

  /**
   * Enables or disables debug mode
   * @param enabled Whether debug mode should be enabled
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Registers a listener for an event
   * @param event The event to listen for
   * @param listener The listener function
   * @returns A function to unregister the listener
   */
  public on<T>(event: EventName | string, listener: Listener<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
    
    // Return a function to unregister this listener
    return () => this.off(event, listener);
  }

  /**
   * Unregisters a listener for an event
   * @param event The event to stop listening for
   * @param listener The listener function to remove
   */
  public off<T>(event: EventName | string, listener: Listener<T>): void {
    if (!this.events.has(event)) return;

    const listeners = this.events.get(event)!;
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
      if (listeners.length === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * Emits an event with a payload
   * @param event The event to emit
   * @param payload The payload to send with the event
   */
  public emit<T>(event: EventName | string, payload: T): void {
    if (this.debugMode) {
      console.log(`[EventBus] Emitting ${event}:`, payload);
    }
    
    if (!this.events.has(event)) return;

    try {
      const listeners = [...this.events.get(event)!]; // Create a copy to avoid issues if listeners are removed during iteration
      listeners.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`[EventBus] Error in listener for event ${event}:`, error);
        }
      });
    } catch (error) {
      console.error(`[EventBus] Error emitting event ${event}:`, error);
    }
  }

  /**
   * Removes all listeners for an event
   * @param event The event to clear listeners for
   */
  public clearListeners(event?: EventName | string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}
