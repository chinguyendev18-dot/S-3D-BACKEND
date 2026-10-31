import type { Request } from 'express';

import type { Role, User } from '../generated/prisma/client';
import { SUPER_ADMIN } from './default-roles';
import { PERMISSION_KEYS, effectivePermissions } from './permissions';

export interface AuthRole {
  id: string;
  key: string;
  name: string;
  scope: Role['scope'];
}

/** The signed-in person as every app sees them: profile, role and what they may do. */
export interface AuthUser {
  active: boolean;
  avatarUrl: string;
  email: string;
  id: string;
  kind: User['kind'];
  lastLoginAt: string | null;
  name: string;
  permissions: string[];
  phone: string;
  role: AuthRole | null;
}

export interface AuthedRequest extends Request {
  accessToken?: string;
  user?: AuthUser;
}

/** The permissions a role really grants (super_admin: all of them, including future ones). */
export function rolePermissions(
  role: Pick<Role, 'key' | 'permissions'> | null,
) {
  if (!role) return [];
  if (role.key === SUPER_ADMIN) return [...PERMISSION_KEYS];
  return effectivePermissions(role.permissions);
}

export function toAuthUser(row: User & { role: Role | null }): AuthUser {
  return {
    active: row.active,
    avatarUrl: row.avatarUrl,
    email: row.email,
    id: row.id,
    kind: row.kind,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    name: row.name,
    permissions: row.kind === 'staff' ? rolePermissions(row.role) : [],
    phone: row.phone,
    role: row.role
      ? {
          id: row.role.id,
          key: row.role.key,
          name: row.role.name,
          scope: row.role.scope,
        }
      : null,
  };
}

export const hasPermission = (
  user: Pick<AuthUser, 'permissions'>,
  key: string,
) => user.permissions.includes(key);
