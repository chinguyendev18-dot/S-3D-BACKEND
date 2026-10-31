/* Shared by the seed and create-admin scripts: database + Supabase admin, from .env. */
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from '@supabase/supabase-js';

import { DEFAULT_ROLES, SUPER_ADMIN } from '../src/access/default-roles';
import { PERMISSION_KEYS } from '../src/access/permissions';
import { LOCKED_BAN } from '../src/auth/auth.constants';
import { PrismaClient, type UserKind } from '../src/generated/prisma/client';

try {
  process.loadEnvFile('.env');
} catch {
  // Variables come from the environment.
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set (see .env.example).`);
  return value;
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL || required('DATABASE_URL'),
    ssl:
      process.env.DATABASE_SSL === 'false'
        ? false
        : { rejectUnauthorized: false },
  }),
});

export const supabase = createClient(
  required('SUPABASE_URL'),
  required('SUPABASE_SECRET_KEY'),
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  },
);

/** Adds the missing built-in roles. Roles edited in the admin keep their edits. */
export async function seedRoles() {
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      create: { ...role, system: true },
      // super_admin is always complete; the others only get their "system" mark back.
      update:
        role.key === SUPER_ADMIN
          ? { permissions: [...PERMISSION_KEYS], scope: 'admin', system: true }
          : { system: true },
      where: { key: role.key },
    });
  }
}

export interface AccountSeed {
  active?: boolean;
  email: string;
  kind: UserKind;
  name: string;
  password: string;
  phone?: string;
  roleKey?: string;
  workshop?: {
    joinedDaysAgo: number;
    note?: string;
    shift: string;
    skills: string[];
  };
}

/** The Supabase user with this email, looked up page by page (the admin API has no search). */
async function findAuthUser(email: string) {
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (found || data.users.length < 200) return found ?? null;
  }
  return null;
}

/**
 * Creates the account if its email has no profile yet. With `overwrite`, an existing account
 * gets this role, password and status (create-admin uses it to recover access).
 */
export async function ensureAccount(seed: AccountSeed, overwrite = false) {
  const email = seed.email.trim().toLowerCase();
  const role = seed.roleKey
    ? await prisma.role.findUniqueOrThrow({ where: { key: seed.roleKey } })
    : null;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !overwrite) return { email, status: 'đã có' as const };

  let id = existing?.id;
  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: seed.password,
      user_metadata: { name: seed.name },
    });
    if (data.user) {
      id = data.user.id;
    } else if (error?.code === 'email_exists') {
      id = (await findAuthUser(email))?.id;
    } else {
      throw error ?? new Error(`Could not create ${email}`);
    }
  }
  if (!id) throw new Error(`Could not find or create ${email}`);

  const active = seed.active ?? true;
  if (existing || overwrite) {
    const { error } = await supabase.auth.admin.updateUserById(id, {
      email_confirm: true,
      password: seed.password,
    });
    if (error) throw error;
  }
  const { error: banError } = await supabase.auth.admin.updateUserById(id, {
    ban_duration: active ? 'none' : LOCKED_BAN,
  });
  if (banError) throw banError;

  const workshop = seed.workshop
    ? {
        joinedAt: new Date(
          Date.now() - seed.workshop.joinedDaysAgo * 86_400_000,
        ),
        note: seed.workshop.note ?? '',
        shift: seed.workshop.shift,
        skills: seed.workshop.skills,
      }
    : null;
  await prisma.user.upsert({
    create: {
      active,
      email,
      id,
      kind: seed.kind,
      name: seed.name,
      phone: seed.phone ?? '',
      roleId: role?.id ?? null,
      ...(workshop ? { workshop: { create: workshop } } : {}),
    },
    update: {
      active,
      kind: seed.kind,
      name: seed.name,
      roleId: role?.id ?? null,
      ...(workshop
        ? { workshop: { upsert: { create: workshop, update: workshop } } }
        : {}),
    },
    where: { id },
  });
  return {
    email,
    status: existing ? ('đã cập nhật' as const) : ('đã tạo' as const),
  };
}
