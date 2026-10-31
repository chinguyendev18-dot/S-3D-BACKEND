import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from './app-exception';

const PRUNE_EVERY = 500;

/**
 * Attempts per key (e.g. sign-in per email + address) within a time window, kept in memory.
 * Supabase limits its own endpoints per IP, but every request reaches it from this server's
 * address, so the per-person limits have to live here.
 */
@Injectable()
export class RateLimiter {
  /** Each key remembers its own window: keys with different windows are pruned together. */
  private readonly hits = new Map<
    string,
    { times: number[]; windowMs: number }
  >();
  private calls = 0;

  /** Counts one attempt; refuses it once `limit` attempts already fall within `windowMs`. */
  consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const recent = (this.hits.get(key)?.times ?? []).filter(
      (at) => now - at < windowMs,
    );

    if (recent.length >= limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((windowMs - (now - recent[0])) / 1000),
      );
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH.TOO_MANY_REQUESTS',
        `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(retryAfter / 60)} phút.`,
        undefined,
        retryAfter,
      );
    }

    recent.push(now);
    this.hits.set(key, { times: recent, windowMs });
    if (++this.calls % PRUNE_EVERY === 0) this.prune(now);
  }

  /** A success clears the count, so a typo followed by the right password costs nothing later. */
  reset(key: string) {
    this.hits.delete(key);
  }

  private prune(now: number) {
    for (const [key, { times, windowMs }] of this.hits) {
      if (!times.some((at) => now - at < windowMs)) this.hits.delete(key);
    }
  }
}
