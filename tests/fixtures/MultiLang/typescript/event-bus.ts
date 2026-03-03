// TypeScript: Typed Event Bus (publish/subscribe pattern)
// Paradigm: Event-driven, Observer pattern, async pub/sub
type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface EventMap {
  [event: string]: unknown;
}

export class EventBus<TEvents extends EventMap = EventMap> {
  private readonly listeners = new Map<keyof TEvents, Set<EventHandler>>();
  private readonly wildcardListeners = new Set<EventHandler<{ event: string; payload: unknown }>>();

  subscribe<K extends keyof TEvents>(
    eventName: K,
    handler: EventHandler<TEvents[K]>
  ): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(handler as EventHandler);
    // Return unsubscribe function
    return () => this.unsubscribe(eventName, handler);
  }

  unsubscribe<K extends keyof TEvents>(
    eventName: K,
    handler: EventHandler<TEvents[K]>
  ): void {
    this.listeners.get(eventName)?.delete(handler as EventHandler);
  }

  subscribeAll(handler: EventHandler<{ event: string; payload: unknown }>): () => void {
    this.wildcardListeners.add(handler);
    return () => this.wildcardListeners.delete(handler);
  }

  async publish<K extends keyof TEvents>(eventName: K, payload: TEvents[K]): Promise<void> {
    const handlers = this.listeners.get(eventName);
    const invocations: Array<void | Promise<void>> = [];

    if (handlers) {
      for (const handler of handlers) {
        invocations.push(handler(payload));
      }
    }
    for (const wh of this.wildcardListeners) {
      invocations.push(wh({ event: String(eventName), payload }));
    }
    await Promise.all(invocations);
  }

  once<K extends keyof TEvents>(eventName: K, handler: EventHandler<TEvents[K]>): void {
    const wrappedHandler: EventHandler<TEvents[K]> = async (payload) => {
      await handler(payload);
      this.unsubscribe(eventName, wrappedHandler);
    };
    this.subscribe(eventName, wrappedHandler);
  }

  listenerCount(eventName: keyof TEvents): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }

  clear(eventName?: keyof TEvents): void {
    if (eventName !== undefined) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
      this.wildcardListeners.clear();
    }
  }
}
