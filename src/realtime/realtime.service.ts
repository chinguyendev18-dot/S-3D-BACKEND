import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

import {
  appRoom,
  userRoom,
  type RealtimeApp,
  type RealtimeEvent,
  type RealtimeEvents,
} from './realtime.events';

/**
 * How other modules push to the apps, e.g. after an order changes:
 *   this.realtime.toUser(order.customerId, 'order:updated', { id, status });
 *   this.realtime.toApp('admin', 'order:updated', { id, status });
 * Nothing is queued: a socket that is down misses it, and the apps reload what they show when
 * they reconnect. Store what must not be lost (notifications) before sending it.
 */
@Injectable()
export class RealtimeService {
  private namespace: Namespace | null = null;

  /** Called by the gateway once socket.io is up. */
  attach(namespace: Namespace) {
    this.namespace = namespace;
  }

  toUser<E extends RealtimeEvent>(
    userId: string,
    event: E,
    payload: RealtimeEvents[E],
  ) {
    this.namespace?.to(userRoom(userId)).emit(event, payload);
  }

  /** Everyone with that app open: all admin pages, all workshop screens. */
  toApp<E extends RealtimeEvent>(
    app: RealtimeApp,
    event: E,
    payload: RealtimeEvents[E],
  ) {
    this.namespace?.to(appRoom(app)).emit(event, payload);
  }

  /** Open sockets on this server. */
  get connections() {
    return this.namespace?.sockets.size ?? 0;
  }
}
