import type { AppEventMap, AppEventType } from '../contracts/events';

type Handler<K extends AppEventType> = (payload: AppEventMap[K]) => void;

export class EventBus {
  private handlers: { [K in AppEventType]?: Set<Handler<K>> } = {};

  on<K extends AppEventType>(event: K, handler: Handler<K>): () => void {
    const set = (this.handlers[event] ??= new Set()) as Set<Handler<K>>;
    set.add(handler);
    return () => set.delete(handler);
  }

  emit<K extends AppEventType>(event: K, payload: AppEventMap[K]): void {
    const set = this.handlers[event] as Set<Handler<K>> | undefined;
    set?.forEach((handler) => handler(payload));
  }
}
