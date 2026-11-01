/** The apps a socket can be opened for: the shop (Web, App), the admin site, the workshop. */
export type RealtimeApp = 'admin' | 'shop' | 'workshop';

export const REALTIME_APPS: RealtimeApp[] = ['admin', 'shop', 'workshop'];

/** The socket.io namespace the apps connect to: <backend origin>/realtime. */
export const REALTIME_NAMESPACE = '/realtime';

/**
 * Everything the backend pushes, with what it carries. Names are "<thing>:<what happened>", the
 * form the storefront's socket code already listens for (features/notifications). Payloads are
 * filled in by the modules that send them (notifications, orders, production…).
 */
export interface RealtimeEvents {
  /** A new notification for this person (GĐ3). */
  'notification:new': { id: string } & Record<string, unknown>;
  'notification:unread_count': { unreadCount: number };
  /** An order changed: status, payment, shipping (GĐ3–5). */
  'order:updated': { id: string; status: string } & Record<string, unknown>;
  /** A production job moved: accepted, machine set, next step, handed over (GĐ4). */
  'production:updated': { id: string; orderId: string } & Record<
    string,
    unknown
  >;
  /** A printer's state from the workshop's network (GĐ4). */
  'printer:status': { id: string; state: string } & Record<string, unknown>;
  /** A material fell under its alert level (GĐ4). */
  'material:low': { id: string; remaining: number } & Record<string, unknown>;
  /** Sent on connecting, once the socket is in its rooms. */
  'realtime:ready': { app: RealtimeApp; userId: string };
  /** Sent just before the server closes a socket (bad ticket, account locked…). */
  'realtime:error': { message: string; messageCode: string };
}

export type RealtimeEvent = keyof RealtimeEvents;

export const userRoom = (userId: string) => `user:${userId}`;
export const appRoom = (app: RealtimeApp) => `app:${app}`;
