import { rolePermissions } from './auth-user';
import { DEFAULT_ROLES, SUPER_ADMIN } from './default-roles';
import {
  PERMISSION_KEYS,
  canUseApp,
  effectivePermissions,
  permissionScope,
} from './permissions';

describe('permissions', () => {
  it('lets every "manage" also open its page', () => {
    expect(effectivePermissions(['admin.orders.manage'])).toEqual([
      'admin.orders.view',
      'admin.orders.manage',
    ]);
  });

  it('drops keys that do not exist', () => {
    expect(
      effectivePermissions(['admin.everything', 'admin.blog.view']),
    ).toEqual(['admin.blog.view']);
  });

  it('opens an app with any permission of its scope', () => {
    expect(canUseApp(['workshop.orders.work'], 'workshop')).toBe(true);
    expect(canUseApp(['workshop.orders.work'], 'admin')).toBe(false);
    expect(canUseApp([], 'admin')).toBe(false);
  });

  it('gives super_admin every permission, even ones its row does not list', () => {
    expect(rolePermissions({ key: SUPER_ADMIN, permissions: [] })).toEqual(
      PERMISSION_KEYS,
    );
  });

  it('builds default roles from their own app only (super_admin aside)', () => {
    for (const role of DEFAULT_ROLES.filter(
      (item) => item.key !== SUPER_ADMIN,
    )) {
      for (const key of role.permissions) {
        expect([role.key, permissionScope(key)]).toEqual([
          role.key,
          role.scope,
        ]);
      }
    }
  });

  it('keeps accounts and roles out of the manager role', () => {
    const manager = DEFAULT_ROLES.find((role) => role.key === 'manager');
    expect(manager?.permissions).not.toContain('admin.accounts.manage');
    expect(manager?.permissions).not.toContain('admin.roles.manage');
    expect(manager?.permissions).toContain('admin.accounts.view');
  });
});
