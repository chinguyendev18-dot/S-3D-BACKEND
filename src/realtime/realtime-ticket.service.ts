import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { RealtimeApp } from './realtime.events';

/** A ticket only opens a socket: it has to be used within this time, and only once. */
export const TICKET_SECONDS = 60;

export interface RealtimeTicket {
  app: RealtimeApp;
  /** Expiry, ms since epoch. */
  exp: number;
  /** One-time id. */
  jti: string;
  sub: string;
}

const encode = (value: string | Buffer) =>
  Buffer.from(value).toString('base64url');

/**
 * Short-lived tickets for opening the realtime socket. The web apps keep the access token in an
 * HttpOnly cookie, out of the page's reach: their server asks for a ticket with it
 * (POST /realtime/ticket) and hands the page that instead. The app does the same with its token.
 */
@Injectable()
export class RealtimeTicketService {
  private readonly logger = new Logger(RealtimeTicketService.name);
  private readonly secret: Buffer;
  /** Tickets already used, until they expire anyway. */
  private readonly used = new Map<string, number>();

  constructor(config: ConfigService) {
    const configured = config.get<string>('REALTIME_SECRET', '');
    if (configured.length >= 32) {
      this.secret = Buffer.from(configured);
    } else {
      // Fine for one server: tickets live a minute and are used where they were issued. Behind
      // several servers set REALTIME_SECRET (the same on each).
      this.secret = randomBytes(32);
      if (config.get('NODE_ENV') === 'production')
        this.logger.warn(
          'REALTIME_SECRET is not set: realtime tickets only work on this instance.',
        );
    }
  }

  issue(userId: string, app: RealtimeApp) {
    const ticket: RealtimeTicket = {
      app,
      exp: Date.now() + TICKET_SECONDS * 1000,
      jti: randomBytes(12).toString('base64url'),
      sub: userId,
    };
    const body = encode(JSON.stringify(ticket));
    return {
      expiresAt: new Date(ticket.exp).toISOString(),
      token: `${body}.${this.sign(body)}`,
    };
  }

  /** The ticket's contents if it is genuine, unexpired and unused; it cannot be used again. */
  redeem(token: string): RealtimeTicket | null {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra !== undefined) return null;

    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given))
      return null;

    let ticket: RealtimeTicket;
    try {
      ticket = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as RealtimeTicket;
    } catch {
      return null;
    }
    const now = Date.now();
    if (typeof ticket.exp !== 'number' || ticket.exp < now) return null;
    if (this.used.has(ticket.jti)) return null;

    this.used.set(ticket.jti, ticket.exp);
    for (const [jti, exp] of this.used) if (exp < now) this.used.delete(jti);
    return ticket;
  }

  private sign(body: string) {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}
