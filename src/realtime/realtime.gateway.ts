import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import type { AuthUser } from '../access/auth-user';
import { canUseApp } from '../access/permissions';
import { UserContextService } from '../access/user-context.service';
import { RealtimeTicketService } from './realtime-ticket.service';
import {
  REALTIME_NAMESPACE,
  appRoom,
  userRoom,
  type RealtimeApp,
  type RealtimeEvents,
} from './realtime.events';
import { RealtimeService } from './realtime.service';

/** How often open sockets are checked again: a locked account or a lost role drops off. */
const RECHECK_MS = 60_000;

interface SocketData {
  app: RealtimeApp;
  /** The page's language, for messages sent to this socket. */
  lang: string;
  userId: string;
}

/** socket.io's event map: one listener per event, taking its payload. */
type ServerEvents = {
  [E in keyof RealtimeEvents]: (payload: RealtimeEvents[E]) => void;
};

type AppSocket = Socket<
  Record<string, never>,
  ServerEvents,
  Record<string, never>,
  Partial<SocketData>
>;

const first = (value: unknown) =>
  typeof value === 'string'
    ? value
    : Array.isArray(value) && typeof value[0] === 'string'
      ? value[0]
      : '';

const mayUse = (user: AuthUser | null, app: RealtimeApp) =>
  Boolean(user?.active && (app === 'shop' || canUseApp(user.permissions, app)));

/**
 * <backend>/realtime (socket.io). A socket opens with a ticket from POST /realtime/ticket
 * (`auth: { token }`, or `?token=` as the storefront sends it) and joins two rooms: its person
 * (user:<id>) and its app (app:admin, app:workshop, app:shop). RealtimeService sends to them.
 */
@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway
  implements
    OnGatewayInit<Namespace>,
    OnGatewayConnection<AppSocket>,
    OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private timer: NodeJS.Timeout | null = null;

  @WebSocketServer()
  private readonly namespace: Namespace;

  constructor(
    private readonly tickets: RealtimeTicketService,
    private readonly users: UserContextService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(namespace: Namespace) {
    this.realtime.attach(namespace);
    this.timer = setInterval(() => void this.recheck(), RECHECK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async handleConnection(socket: AppSocket) {
    const token =
      first((socket.handshake.auth as Record<string, unknown>)?.token) ||
      first(socket.handshake.query.token);
    const ticket = token ? this.tickets.redeem(token) : null;
    if (!ticket) {
      return this.refuse(
        socket,
        'REALTIME.INVALID_TICKET',
        'Phiên kết nối đã hết hạn. Đang kết nối lại…',
      );
    }

    const user = await this.users.get(ticket.sub).catch(() => null);
    if (!mayUse(user, ticket.app)) {
      return this.refuse(
        socket,
        'AUTH.INSUFFICIENT_PERMISSIONS',
        'Tài khoản không còn quyền nhận cập nhật.',
      );
    }

    socket.data = {
      app: ticket.app,
      lang: first(socket.handshake.query.lang) || 'vi',
      userId: ticket.sub,
    };
    await socket.join([userRoom(ticket.sub), appRoom(ticket.app)]);
    socket.emit('realtime:ready', { app: ticket.app, userId: ticket.sub });
  }

  /** Drops sockets whose account was locked or lost the app since they connected. */
  private async recheck() {
    if (!this.namespace) return;
    for (const socket of this.namespace.sockets.values() as Iterable<AppSocket>) {
      const { app, userId } = socket.data;
      if (!app || !userId) continue;
      const user = await this.users.get(userId).catch(() => undefined);
      // A database hiccup (undefined) keeps the socket; only a clear "no" closes it.
      if (user !== undefined && !mayUse(user, app)) {
        this.refuse(
          socket,
          'AUTH.ACCOUNT_CHANGED',
          'Quyền của tài khoản đã thay đổi. Vui lòng tải lại trang.',
        );
      }
    }
  }

  /** "io server disconnect" on the page: the storefront fetches a new ticket and retries. */
  private refuse(socket: AppSocket, messageCode: string, message: string) {
    this.logger.debug(`Socket ${socket.id} refused: ${messageCode}`);
    socket.emit('realtime:error', { message, messageCode });
    socket.disconnect(true);
  }
}
