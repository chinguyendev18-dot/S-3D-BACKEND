import { ConfigService } from '@nestjs/config';

import { RealtimeTicketService } from './realtime-ticket.service';

const service = () => new RealtimeTicketService(new ConfigService({}));

describe('RealtimeTicketService', () => {
  it('redeems its own ticket once', () => {
    const tickets = service();
    const { token } = tickets.issue('user-1', 'admin');
    expect(tickets.redeem(token)).toMatchObject({
      app: 'admin',
      sub: 'user-1',
    });
    expect(tickets.redeem(token)).toBeNull();
  });

  it('refuses a changed ticket, or one from another server', () => {
    const tickets = service();
    const { token } = tickets.issue('user-1', 'shop');
    const [body, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body, 'base64url').toString()),
        app: 'admin',
      }),
    ).toString('base64url');
    expect(tickets.redeem(`${forged}.${signature}`)).toBeNull();
    expect(service().redeem(token)).toBeNull();
    expect(tickets.redeem('not-a-ticket')).toBeNull();
  });

  it('refuses an expired ticket', () => {
    jest.useFakeTimers();
    try {
      const tickets = service();
      const { token } = tickets.issue('user-1', 'shop');
      jest.advanceTimersByTime(61_000);
      expect(tickets.redeem(token)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
