import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';

import type { AuthUser } from '../src/access/auth-user';
import { UserContextService } from '../src/access/user-context.service';
import { AppModule } from '../src/app.module';
import { RealtimeTicketService } from '../src/realtime/realtime-ticket.service';
import { RealtimeService } from '../src/realtime/realtime.service';

const staff = (id: string, permissions: string[]): AuthUser => ({
  active: true,
  avatarUrl: '',
  email: `${id}@s3d.local`,
  id,
  kind: 'staff',
  lastLoginAt: null,
  name: id,
  permissions,
  phone: '',
  role: null,
});

const PEOPLE: Record<string, AuthUser> = {
  'admin-1': staff('admin-1', ['admin.orders.view']),
  'customer-1': { ...staff('customer-1', []), kind: 'customer' },
  'locked-1': { ...staff('locked-1', ['admin.orders.view']), active: false },
};

/** A real socket.io connection to the gateway; who is who comes from PEOPLE, not the database. */
describe('Realtime (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let tickets: RealtimeTicketService;
  let realtime: RealtimeService;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UserContextService)
      .useValue({ get: (id: string) => Promise.resolve(PEOPLE[id] ?? null) })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.listen(0);
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    url = `http://127.0.0.1:${port}/realtime`;
    tickets = app.get(RealtimeTicketService);
    realtime = app.get(RealtimeService);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await app.close();
  });

  const connect = (token: string) => {
    const socket = io(url, {
      auth: { token },
      reconnection: false,
      transports: ['websocket'],
    });
    sockets.push(socket);
    return socket;
  };
  const next = <T>(socket: Socket, event: string) =>
    new Promise<T>((resolve) => socket.once(event, resolve));

  it('joins the person and app rooms, and gets what is sent to them', async () => {
    const socket = connect(tickets.issue('admin-1', 'admin').token);
    await expect(next(socket, 'realtime:ready')).resolves.toEqual({
      app: 'admin',
      userId: 'admin-1',
    });

    const toPerson = next(socket, 'notification:unread_count');
    realtime.toUser('admin-1', 'notification:unread_count', { unreadCount: 3 });
    await expect(toPerson).resolves.toEqual({ unreadCount: 3 });

    const toApp = next(socket, 'order:updated');
    realtime.toApp('admin', 'order:updated', {
      id: 'o-1',
      status: 'processing',
    });
    await expect(toApp).resolves.toEqual({ id: 'o-1', status: 'processing' });
  });

  it('does not send one person what is meant for another, nor for another app', async () => {
    const customer = connect(tickets.issue('customer-1', 'shop').token);
    await next(customer, 'realtime:ready');
    const received: string[] = [];
    customer.onAny((event: string) => received.push(event));

    realtime.toUser('admin-1', 'notification:unread_count', { unreadCount: 1 });
    realtime.toApp('admin', 'order:updated', {
      id: 'o-1',
      status: 'processing',
    });
    realtime.toUser('customer-1', 'order:updated', {
      id: 'o-2',
      status: 'shipping',
    });
    await next(customer, 'order:updated');
    expect(received).toEqual(['order:updated']);
  });

  it('closes sockets with a used, forged or missing ticket, or a locked account', async () => {
    const { token } = tickets.issue('customer-1', 'shop');
    await next(connect(token), 'realtime:ready');

    for (const bad of [
      token,
      `${token}x`,
      '',
      tickets.issue('locked-1', 'admin').token,
    ]) {
      const socket = connect(bad);
      const reason = await next<string>(socket, 'disconnect');
      expect(reason).toBe('io server disconnect');
    }
  });
});
