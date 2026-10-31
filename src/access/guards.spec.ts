import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { SupabaseService } from '../supabase/supabase.service';
import { AuthGuard } from './auth.guard';
import type { AuthUser, AuthedRequest } from './auth-user';
import { IS_PUBLIC, PERMISSION_RULE, type PermissionRule } from './decorators';
import { PermissionsGuard } from './permissions.guard';
import type { UserContextService } from './user-context.service';

const user = (permissions: string[], active = true): AuthUser => ({
  active,
  avatarUrl: '',
  email: 'a@s3d.local',
  id: '00000000-0000-0000-0000-000000000001',
  kind: 'staff',
  lastLoginAt: null,
  name: 'A',
  permissions,
  phone: '',
  role: null,
});

function contextFor(
  request: Partial<AuthedRequest>,
  metadata: Record<string, unknown> = {},
) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((key: unknown) => metadata[key as string]);
  const req = { headers: {}, ...request } as AuthedRequest;
  const context = {
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { context, reflector, req };
}

describe('AuthGuard', () => {
  const verifyAccessToken = jest.fn();
  const ensure = jest.fn();
  const supabase = { verifyAccessToken } as unknown as SupabaseService;
  const users = { ensure } as unknown as UserContextService;

  beforeEach(() => jest.resetAllMocks());

  it('lets public routes through without a token', async () => {
    const { context, reflector } = contextFor({}, { [IS_PUBLIC]: true });
    await expect(
      new AuthGuard(reflector, supabase, users).canActivate(context),
    ).resolves.toBe(true);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('asks for a sign-in on other routes', async () => {
    const { context, reflector } = contextFor({});
    await expect(
      new AuthGuard(reflector, supabase, users).canActivate(context),
    ).rejects.toMatchObject({
      messageCode: 'AUTH.UNAUTHORIZED',
    });
  });

  it('refuses locked accounts even with a valid token', async () => {
    verifyAccessToken.mockResolvedValue({ email: 'a@s3d.local', sub: 'id' });
    ensure.mockResolvedValue(user([], false));
    const { context, reflector } = contextFor({
      headers: { authorization: 'Bearer token' },
    });
    await expect(
      new AuthGuard(reflector, supabase, users).canActivate(context),
    ).rejects.toMatchObject({
      messageCode: 'AUTH.LOGIN.ACCOUNT_DISABLED',
    });
  });

  it('attaches the person and the token', async () => {
    verifyAccessToken.mockResolvedValue({ email: 'a@s3d.local', sub: 'id' });
    ensure.mockResolvedValue(user(['admin.blog.view']));
    const { context, reflector, req } = contextFor({
      headers: { authorization: 'Bearer token' },
    });
    await new AuthGuard(reflector, supabase, users).canActivate(context);
    expect(req.user?.permissions).toEqual(['admin.blog.view']);
    expect(req.accessToken).toBe('token');
  });
});

describe('PermissionsGuard', () => {
  const check = (rule: PermissionRule | undefined, permissions: string[]) => {
    const { context, reflector } = contextFor(
      { user: user(permissions) },
      { [PERMISSION_RULE]: rule },
    );
    return () => new PermissionsGuard(reflector).canActivate(context);
  };

  it('allows routes without a rule', () => {
    expect(check(undefined, [])()).toBe(true);
  });

  it('needs every permission in "all" mode', () => {
    const rule: PermissionRule = {
      keys: ['admin.roles.manage', 'admin.accounts.manage'],
      mode: 'all',
    };
    expect(check(rule, ['admin.roles.manage', 'admin.accounts.manage'])()).toBe(
      true,
    );
    expect(check(rule, ['admin.roles.manage'])).toThrow();
  });

  it('needs one permission in "any" mode', () => {
    const rule: PermissionRule = {
      keys: ['admin.accounts.view', 'admin.roles.manage'],
      mode: 'any',
    };
    expect(check(rule, ['admin.roles.manage'])()).toBe(true);
    expect(check(rule, ['admin.blog.view'])).toThrow();
  });

  it('opens an app with any of its permissions', () => {
    const rule: PermissionRule = { app: 'workshop', mode: 'app' };
    expect(check(rule, ['workshop.materials.move'])()).toBe(true);
    expect(check(rule, ['admin.orders.manage'])).toThrow();
  });
});
