import type { AuthUser } from '../access/auth-user';
import type { UserContextService } from '../access/user-context.service';
import type { AuditService } from '../audit/audit.service';
import { RateLimiter } from '../common/rate-limiter';
import type { PrismaService } from '../prisma/prisma.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';

const person = (permissions: string[], active = true): AuthUser => ({
  active,
  avatarUrl: '',
  email: 'a@s3d.local',
  id: 'user-1',
  kind: permissions.length ? 'staff' : 'customer',
  lastLoginAt: null,
  name: 'A',
  permissions,
  phone: '',
  role: null,
});

const session = {
  access_token: 'access',
  expires_at: 2_000_000_000,
  expires_in: 3600,
  refresh_token: 'refresh',
};

function setup() {
  const auth = {
    refreshSession: jest.fn(),
    resend: jest.fn().mockResolvedValue({ error: null }),
    signInWithPassword: jest.fn(),
  };
  const signOut = jest.fn().mockResolvedValue({ error: null });
  const updateUserById = jest.fn().mockResolvedValue({ error: null });
  const getUserById = jest.fn();
  const supabase = {
    admin: { auth: { admin: { getUserById, signOut, updateUserById } } },
    client: () => ({ auth }),
    verifyAccessToken: jest.fn(),
  };
  const users = {
    ensureFromSupabase: jest.fn(),
    get: jest.fn(),
    invalidate: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const service = new AuthService(
    supabase as unknown as SupabaseService,
    users as unknown as UserContextService,
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    new RateLimiter(),
  );
  return {
    audit,
    auth,
    getUserById,
    prisma,
    service,
    signOut,
    supabase,
    updateUserById,
    users,
  };
}

describe('AuthService', () => {
  it('answers a wrong password with INVALID_CREDENTIALS and logs it', async () => {
    const { audit, auth, service } = setup();
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: {
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      },
    });
    await expect(
      service.login({ email: 'a@s3d.local', password: 'x' }, {}),
    ).rejects.toMatchObject({
      messageCode: 'AUTH.LOGIN.INVALID_CREDENTIALS',
      status: 401,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_failed' }),
    );
  });

  it('sends an unconfirmed email to the code screen', async () => {
    const { auth, service } = setup();
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    });
    await expect(
      service.login({ email: 'a@s3d.local', password: 'x' }, {}),
    ).rejects.toMatchObject({
      messageCode: 'AUTH.LOGIN.NOT_VERIFIED',
    });
    expect(auth.resend).toHaveBeenCalledWith({
      email: 'a@s3d.local',
      type: 'signup',
    });
  });

  it('keeps customers out of the admin site and ends the session it opened', async () => {
    const { auth, service, signOut, users } = setup();
    auth.signInWithPassword.mockResolvedValue({
      data: { session, user: { id: 'user-1' } },
      error: null,
    });
    users.ensureFromSupabase.mockResolvedValue(person([]));
    await expect(
      service.login({ app: 'admin', email: 'a@s3d.local', password: 'x' }, {}),
    ).rejects.toMatchObject({
      messageCode: 'AUTH.INSUFFICIENT_PERMISSIONS',
      status: 403,
    });
    expect(signOut).toHaveBeenCalledWith('access', 'local');
  });

  it('signs staff in to the app their role opens', async () => {
    const { auth, service, users } = setup();
    auth.signInWithPassword.mockResolvedValue({
      data: { session, user: { id: 'user-1' } },
      error: null,
    });
    users.ensureFromSupabase.mockResolvedValue(
      person(['workshop.orders.work']),
    );
    const result = await service.login(
      { app: 'workshop', email: 'a@s3d.local', password: 'x' },
      {},
    );
    expect(result).toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(result.user.permissions).toEqual(['workshop.orders.work']);
  });

  it('stops after too many sign-in attempts', async () => {
    const { auth, service } = setup();
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', message: '' },
    });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await service
        .login({ email: 'a@s3d.local', password: 'x' }, { ip: '1.2.3.4' })
        .catch(() => undefined);
    }
    await expect(
      service.login({ email: 'a@s3d.local', password: 'x' }, { ip: '1.2.3.4' }),
    ).rejects.toMatchObject({
      messageCode: 'AUTH.TOO_MANY_REQUESTS',
      status: 429,
    });
  });

  it('does not reset a password with a token from a password sign-in', async () => {
    const { service, supabase, updateUserById } = setup();
    supabase.verifyAccessToken.mockResolvedValue({
      amr: [{ method: 'password', timestamp: 1 }],
      sub: 'user-1',
    });
    await expect(
      service.resetPassword(
        { newPassword: 'moi12345', resetToken: 'access' },
        {},
      ),
    ).rejects.toMatchObject({ messageCode: 'AUTH.VERIFY.INVALID_TOKEN' });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('does not reset a password with a session whose code was entered long ago', async () => {
    const { service, supabase, updateUserById } = setup();
    // E.g. the session a customer opened by confirming their sign-up email last week.
    supabase.verifyAccessToken.mockResolvedValue({
      amr: [{ method: 'otp', timestamp: Date.now() / 1000 - 7 * 86_400 }],
      sub: 'user-1',
    });
    await expect(
      service.resetPassword(
        { newPassword: 'moi12345', resetToken: 'old-session' },
        {},
      ),
    ).rejects.toMatchObject({ messageCode: 'AUTH.VERIFY.INVALID_TOKEN' });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('resets a password with the session the emailed code opened, then ends every session', async () => {
    const { service, signOut, supabase, updateUserById } = setup();
    supabase.verifyAccessToken.mockResolvedValue({
      amr: [{ method: 'recovery', timestamp: Math.floor(Date.now() / 1000) }],
      sub: 'user-1',
    });
    await service.resetPassword(
      { newPassword: 'moi12345', resetToken: 'recovery' },
      {},
    );
    expect(updateUserById).toHaveBeenCalledWith('user-1', {
      password: 'moi12345',
    });
    expect(signOut).toHaveBeenCalledWith('recovery', 'global');
  });

  it('refuses to refresh a locked account', async () => {
    const { auth, service, users } = setup();
    auth.refreshSession.mockResolvedValue({
      data: { session, user: { id: 'user-1' } },
      error: null,
    });
    users.ensureFromSupabase.mockResolvedValue(
      person(['admin.blog.view'], false),
    );
    await expect(
      service.refresh({ app: 'admin', refreshToken: 'refresh' }, {}),
    ).rejects.toMatchObject({
      messageCode: 'AUTH.LOGIN.ACCOUNT_DISABLED',
    });
  });

  it('does not promise a code to an address that is already confirmed', async () => {
    const { auth, getUserById, prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    getUserById.mockResolvedValue({
      data: { user: { email_confirmed_at: '2026-10-30T18:41:02Z' } },
    });
    await expect(
      service.resendOtp({ email: 'a@s3d.local', type: 'account' }),
    ).rejects.toMatchObject({ messageCode: 'AUTH.VERIFY.ALREADY_VERIFIED' });
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it('resends the code to an address still waiting for it', async () => {
    const { auth, getUserById, prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    getUserById.mockResolvedValue({
      data: { user: { email_confirmed_at: null } },
    });
    await service.resendOtp({ email: 'a@s3d.local', type: 'account' });
    expect(auth.resend).toHaveBeenCalledWith({
      email: 'a@s3d.local',
      type: 'signup',
    });
  });
});
