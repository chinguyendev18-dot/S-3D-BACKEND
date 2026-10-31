import { rolePermissions, type AuthUser } from '../access/auth-user';
import { DEFAULT_ROLES } from '../access/default-roles';
import type { UserContextService } from '../access/user-context.service';
import type { AuditService } from '../audit/audit.service';
import type { Role } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RolesService } from '../roles/roles.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { StaffAccountsService } from './staff-accounts.service';

const roleRow = (key: string): Role => {
  const seed = DEFAULT_ROLES.find((role) => role.key === key)!;
  return {
    createdAt: new Date(),
    description: seed.description,
    id: `role-${key}`,
    key,
    name: seed.name,
    permissions: seed.permissions,
    scope: seed.scope,
    sortOrder: seed.sortOrder,
    system: true,
    updatedAt: new Date(),
  };
};

const actorWith = (roleKey: string, id = 'actor'): AuthUser => ({
  active: true,
  avatarUrl: '',
  email: `${id}@s3d.local`,
  id,
  kind: 'staff',
  lastLoginAt: null,
  name: id,
  permissions: rolePermissions(roleRow(roleKey)),
  phone: '',
  role: null,
});

const userRow = (id: string, roleKey: string, active = true) => ({
  active,
  avatarUrl: '',
  createdAt: new Date(),
  email: `${id}@s3d.local`,
  id,
  kind: 'staff' as const,
  lastLoginAt: null,
  name: id,
  phone: '',
  role: roleRow(roleKey),
  roleId: `role-${roleKey}`,
  updatedAt: new Date(),
  workshop: null,
});

function setup() {
  const prisma = {
    user: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const updateUserById = jest.fn().mockResolvedValue({ data: {}, error: null });
  const supabase = { admin: { auth: { admin: { updateUserById } } } };
  const roles = {
    find: jest.fn((id: string) =>
      Promise.resolve(roleRow(id.replace('role-', ''))),
    ),
  };
  const service = new StaffAccountsService(
    prisma as unknown as PrismaService,
    supabase as unknown as SupabaseService,
    { invalidate: jest.fn() } as unknown as UserContextService,
    roles as unknown as RolesService,
    { record: jest.fn() } as unknown as AuditService,
  );
  return { prisma, service, updateUserById };
}

describe('StaffAccountsService rules', () => {
  it('does not let a manager hand out the super admin role', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow('target', 'sales'));
    await expect(
      service.update(
        actorWith('manager'),
        'target',
        { roleId: 'role-super_admin' },
        {},
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('does not let anyone touch an account above their own', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow('boss', 'super_admin'));
    await expect(
      service.update(actorWith('manager'), 'boss', { name: 'Đổi tên' }, {}),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refuses to lock or demote yourself', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow('actor', 'super_admin'));
    await expect(
      service.update(actorWith('super_admin'), 'actor', { active: false }, {}),
    ).rejects.toMatchObject({ messageCode: 'ACCOUNT.SELF_CHANGE' });
  });

  it('keeps the last super admin', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(
      userRow('other-admin', 'super_admin'),
    );
    prisma.user.count.mockResolvedValue(0);
    await expect(
      service.update(
        actorWith('super_admin'),
        'other-admin',
        { roleId: 'role-manager' },
        {},
      ),
    ).rejects.toMatchObject({ messageCode: 'ACCOUNT.LAST_SUPER_ADMIN' });
  });

  it('keeps the last workshop lead', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow('lead', 'workshop_lead'));
    prisma.user.findMany.mockResolvedValue([
      userRow('tech', 'workshop_technician'),
    ]);
    await expect(
      service.update(
        actorWith('super_admin'),
        'lead',
        { active: false },
        {},
        'workshop',
      ),
    ).rejects.toMatchObject({ messageCode: 'ACCOUNT.LAST_WORKSHOP_LEAD' });
  });

  it('hides admin accounts from the workshop', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userRow('seller', 'sales'));
    await expect(
      service.update(
        actorWith('workshop_lead'),
        'seller',
        { name: 'X' },
        {},
        'workshop',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('locks the sign-in itself when an account is turned off', async () => {
    const { prisma, service, updateUserById } = setup();
    prisma.user.findUnique.mockResolvedValue(
      userRow('tech', 'workshop_technician'),
    );
    prisma.user.update.mockResolvedValue(
      userRow('tech', 'workshop_technician', false),
    );
    await service.update(
      actorWith('workshop_lead'),
      'tech',
      { active: false },
      {},
      'workshop',
    );
    expect(updateUserById).toHaveBeenCalledWith('tech', {
      ban_duration: '876000h',
    });
  });
});
