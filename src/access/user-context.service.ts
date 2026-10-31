import { Injectable } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { conflict } from '../common/app-exception';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toAuthUser, type AuthUser } from './auth-user';

/**
 * Who the database is about to see on every request is cached for a short while: the database
 * is a network hop away, and a role change or a locked account only has to show within seconds.
 */
const CACHE_MS = 30_000;

export interface IdentityInput {
  email: string;
  id: string;
  metadata?: Record<string, unknown>;
}

function nameFrom(identity: IdentityInput) {
  const meta = identity.metadata ?? {};
  for (const key of ['name', 'full_name', 'fullname', 'fullName']) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim())
      return value.trim().slice(0, 120);
  }
  return identity.email.split('@')[0];
}

@Injectable()
export class UserContextService {
  private readonly cache = new Map<string, { at: number; user: AuthUser }>();

  constructor(private readonly prisma: PrismaService) {}

  /** The person with this id, or null when they have no profile yet. */
  async get(id: string, fresh = false): Promise<AuthUser | null> {
    const hit = this.cache.get(id);
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.user;

    const row = await this.prisma.user.findUnique({
      include: { role: true },
      where: { id },
    });
    if (!row) {
      this.cache.delete(id);
      return null;
    }
    const user = toAuthUser(row);
    this.cache.set(id, { at: Date.now(), user });
    return user;
  }

  /**
   * The profile of someone Supabase knows, created as a customer the first time (accounts made
   * on the Supabase dashboard or through Google have no profile until they sign in).
   */
  async ensure(identity: IdentityInput, fresh = false): Promise<AuthUser> {
    const email = identity.email.trim().toLowerCase();
    const existing = await this.get(identity.id, fresh);
    if (existing) {
      if (existing.email !== email && email) {
        // The email was changed through Supabase: follow it.
        await this.prisma.user.update({
          data: { email },
          where: { id: identity.id },
        });
        return (await this.get(identity.id, true)) ?? existing;
      }
      return existing;
    }

    try {
      await this.prisma.user.create({
        data: {
          email,
          id: identity.id,
          kind: 'customer',
          name: nameFrom({ ...identity, email }),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Two first requests at once: the other one created it.
        const created = await this.get(identity.id, true);
        if (created) return created;
        throw conflict(
          'ACCOUNT.EMAIL_CONFLICT',
          'Email này đã gắn với một hồ sơ khác. Vui lòng liên hệ quản trị viên.',
        );
      }
      throw error;
    }
    return (await this.get(identity.id, true)) as AuthUser;
  }

  ensureFromSupabase(user: SupabaseUser, fresh = false) {
    return this.ensure(
      { email: user.email ?? '', id: user.id, metadata: user.user_metadata },
      fresh,
    );
  }

  /** Forget the cached copy of one person, or of everyone (a role's permissions changed). */
  invalidate(id?: string) {
    if (id) this.cache.delete(id);
    else this.cache.clear();
  }
}
