import { HttpStatus, Injectable } from '@nestjs/common';
import type { Session } from '@supabase/supabase-js';

import type { AuthUser } from '../access/auth-user';
import { canUseApp } from '../access/permissions';
import { UserContextService } from '../access/user-context.service';
import { withMessage } from '../common/api-result';
import {
  AppException,
  badRequest,
  forbidden,
  unauthorized,
} from '../common/app-exception';
import { RateLimiter } from '../common/rate-limiter';
import type { RequestMeta } from '../common/request-meta';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LIMITS } from './auth.constants';
import type {
  ChangePasswordDto,
  ClientApp,
  EmailDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  SocialDto,
  UpdateProfileDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { fromSupabase, supabaseCode } from './supabase-errors';

/** What a successful sign-in returns. The web apps keep the tokens in HttpOnly cookies. */
export interface SignedIn {
  accessToken: string;
  /** ISO time the access token stops working (refresh before then). */
  expiresAt: string;
  expiresIn: number;
  refreshToken: string;
  user: AuthUser;
}

const APP_NAMES: Record<ClientApp, string> = {
  admin: 'trang quản trị',
  shop: 'cửa hàng',
  workshop: 'màn hình xưởng',
};

/** Methods in a token's `amr` that come from proving the email (a code), not a password. */
const EMAIL_PROOF = new Set(['otp', 'recovery', 'magiclink', 'email/signup']);

/**
 * How long after entering the emailed code a new password may still be set. A session opened by
 * the sign-up code keeps that `amr` for good, so without this limit any old session of an account
 * made by sign-up could change its password without the current one.
 */
const RESET_WINDOW_SECONDS = 15 * 60;

function provedEmailRecently(amr: unknown) {
  if (!Array.isArray(amr)) return false;
  const since = Date.now() / 1000 - RESET_WINDOW_SECONDS;
  return amr.some(
    (entry: unknown) =>
      typeof entry === 'object' &&
      entry !== null &&
      EMAIL_PROOF.has((entry as { method?: string }).method ?? '') &&
      ((entry as { timestamp?: number }).timestamp ?? 0) >= since,
  );
}

const invalidCode = () =>
  badRequest(
    'AUTH.VERIFY.INVALID_OTP',
    'Mã xác nhận không đúng hoặc đã hết hạn.',
  );

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly users: UserContextService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly limiter: RateLimiter,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<SignedIn> {
    const app = dto.app ?? 'shop';
    const key = `login:${dto.email}:${meta.ip ?? ''}`;
    this.limiter.consume(key, ...LIMITS.login);

    const { data, error } = await this.supabase
      .client()
      .auth.signInWithPassword({ email: dto.email, password: dto.password });

    if (error || !data.session) {
      if (supabaseCode(error) === 'email_not_confirmed') {
        // The code screen comes next: make sure a fresh code is on its way.
        void this.supabase
          .client()
          .auth.resend({ email: dto.email, type: 'signup' })
          .catch(() => undefined);
        throw new AppException(
          HttpStatus.FORBIDDEN,
          'AUTH.LOGIN.NOT_VERIFIED',
          'Email chưa được xác nhận. Hãy nhập mã vừa gửi tới email của bạn.',
        );
      }
      const failure = fromSupabase(error, () =>
        unauthorized(
          'Email hoặc mật khẩu không đúng.',
          'AUTH.LOGIN.INVALID_CREDENTIALS',
        ),
      );
      await this.audit.record({
        ...meta,
        action: 'auth.login_failed',
        actor: { email: dto.email, name: dto.email },
        result: 'failed',
        summary:
          failure.messageCode === 'AUTH.LOGIN.ACCOUNT_DISABLED'
            ? `Đăng nhập ${APP_NAMES[app]} bị chặn: tài khoản đã khoá`
            : `Đăng nhập ${APP_NAMES[app]} thất bại với email “${dto.email}”`,
      });
      throw failure;
    }

    this.limiter.reset(key);
    const user = await this.users.ensureFromSupabase(data.user, true);
    await this.admit(user, app, data.session.access_token, meta);
    await this.recordSignIn(user, `Đăng nhập ${APP_NAMES[app]}`, meta);
    return this.signedIn(data.session, user);
  }

  async register(dto: RegisterDto, meta: RequestMeta) {
    this.limiter.consume(`register:${dto.email}`, ...LIMITS.register);
    this.limiter.consume(
      `register-ip:${meta.ip ?? ''}`,
      ...LIMITS.registerPerAddress,
    );

    const name =
      (dto.name || dto.fullname || '').trim() || dto.email.split('@')[0];
    const { data, error } = await this.supabase.client().auth.signUp({
      email: dto.email,
      options: { data: { name } },
      password: dto.password,
    });

    const exists = () =>
      new AppException(
        HttpStatus.CONFLICT,
        'AUTH.REGISTER.EMAIL_EXISTS',
        'Email này đã có tài khoản. Hãy đăng nhập.',
      );
    if (error) {
      throw fromSupabase(error, () =>
        ['user_already_exists', 'email_exists'].includes(supabaseCode(error))
          ? exists()
          : badRequest(
              'AUTH.REGISTER.FAILED',
              'Chưa đăng ký được. Vui lòng thử lại.',
            ),
      );
    }
    // A confirmed address comes back as a user without identities (Supabase hides that it exists).
    if (!data.user || (data.user.identities?.length ?? 0) === 0) throw exists();

    const user = await this.users.ensureFromSupabase(data.user, true);
    await this.audit.record({
      ...meta,
      action: 'auth.register',
      actor: user,
      summary: 'Đăng ký tài khoản khách hàng',
      target: { id: user.id, label: user.name, type: 'account' },
    });

    if (data.session) {
      return withMessage(
        this.signedIn(data.session, user),
        'Đăng ký thành công.',
        'AUTH.REGISTER.SUCCESS',
      );
    }
    return withMessage(
      { email: dto.email, verificationRequired: true },
      'Đã gửi mã xác nhận tới email của bạn.',
      'AUTH.REGISTER.SUCCESS',
    );
  }

  /** The emailed code: confirms a new account (and signs in), or opens a password reset. */
  async verifyEmail(dto: VerifyEmailDto, meta: RequestMeta) {
    this.limiter.consume(
      `verify:${dto.type}:${dto.email}`,
      ...LIMITS.verifyCode,
    );

    const { data, error } = await this.supabase.client().auth.verifyOtp({
      email: dto.email,
      token: dto.code,
      type: dto.type === 'forgotpassword' ? 'recovery' : 'email',
    });
    if (error || !data.session || !data.user) {
      throw fromSupabase(error, invalidCode);
    }
    this.limiter.reset(`verify:${dto.type}:${dto.email}`);

    if (dto.type === 'forgotpassword') {
      return withMessage(
        { resetReady: true, resetToken: data.session.access_token },
        'Mã đúng. Hãy đặt mật khẩu mới.',
        'AUTH.VERIFY.SUCCESS',
      );
    }

    const user = await this.users.ensureFromSupabase(data.user, true);
    await this.admit(user, 'shop', data.session.access_token, meta);
    await this.audit.record({
      ...meta,
      action: 'auth.verify_email',
      actor: user,
      summary: 'Xác nhận email',
      target: { id: user.id, label: user.name, type: 'account' },
    });
    return withMessage(
      this.signedIn(data.session, user),
      'Đã xác nhận email.',
      'AUTH.VERIFY.SUCCESS',
    );
  }

  async resendOtp(dto: ResendOtpDto) {
    if (dto.type === 'forgotpassword') return this.sendResetPassword(dto);

    this.limiter.consume(`send:${dto.email}`, ...LIMITS.sendCode);
    // Supabase answers "sent" for an address already confirmed, yet sends nothing: the customer
    // would wait for a code that never comes.
    if (await this.emailConfirmed(dto.email)) {
      throw badRequest(
        'AUTH.VERIFY.ALREADY_VERIFIED',
        'Email này đã được xác nhận. Hãy quay lại đăng nhập bằng email và mật khẩu.',
      );
    }
    const { error } = await this.supabase
      .client()
      .auth.resend({ email: dto.email, type: 'signup' });
    if (error) {
      throw fromSupabase(error, () =>
        badRequest(
          'AUTH.RESEND_OTP.FAILED',
          'Chưa gửi lại được mã. Vui lòng thử lại.',
        ),
      );
    }
    return withMessage(
      null,
      'Đã gửi lại mã xác nhận.',
      'AUTH.RESEND_OTP.SUCCESS',
    );
  }

  private async emailConfirmed(email: string) {
    const profile = await this.prisma.user.findUnique({
      select: { id: true },
      where: { email },
    });
    if (!profile) return false;
    const { data } = await this.supabase.admin.auth.admin.getUserById(
      profile.id,
    );
    return Boolean(data.user?.email_confirmed_at);
  }

  /** Always answers the same for unknown emails, so the form cannot tell who has an account. */
  async sendResetPassword(dto: EmailDto) {
    this.limiter.consume(`send:${dto.email}`, ...LIMITS.sendCode);
    const { error } = await this.supabase
      .client()
      .auth.resetPasswordForEmail(dto.email);
    if (error) {
      throw fromSupabase(error, () =>
        badRequest(
          'AUTH.FORGOT_PASSWORD.FAILED',
          'Chưa gửi được mã. Vui lòng thử lại.',
        ),
      );
    }
    return withMessage(
      null,
      'Nếu email này có tài khoản, mã đặt lại mật khẩu đã được gửi.',
      'AUTH.FORGOT_PASSWORD.SUCCESS',
    );
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta) {
    let token = dto.resetToken ?? '';
    let userId = '';

    if (token) {
      const claims = await this.supabase.verifyAccessToken(token);
      // Only a session opened with the emailed code, just now, may set a password without the old one.
      if (!claims || !provedEmailRecently(claims.amr)) {
        throw badRequest(
          'AUTH.VERIFY.INVALID_TOKEN',
          'Phiên đặt lại mật khẩu đã hết hạn. Hãy yêu cầu mã mới.',
        );
      }
      userId = claims.sub;
    } else if (dto.email && dto.code) {
      this.limiter.consume(
        `verify:forgotpassword:${dto.email}`,
        ...LIMITS.verifyCode,
      );
      const { data, error } = await this.supabase.client().auth.verifyOtp({
        email: dto.email,
        token: dto.code,
        type: 'recovery',
      });
      if (error || !data.session || !data.user)
        throw fromSupabase(error, invalidCode);
      token = data.session.access_token;
      userId = data.user.id;
    } else {
      throw badRequest('VALIDATION_ERROR', 'Thiếu mã xác nhận.');
    }

    const { error } = await this.supabase.admin.auth.admin.updateUserById(
      userId,
      {
        password: dto.newPassword,
      },
    );
    if (error) {
      throw fromSupabase(error, () =>
        badRequest(
          'AUTH.RESET_PASSWORD.FAILED',
          'Chưa đặt lại được mật khẩu. Vui lòng thử lại.',
        ),
      );
    }

    // A new password ends every session, including the one the code opened.
    await this.signOut(token, 'global');
    this.users.invalidate(userId);
    const user = await this.users.get(userId);
    await this.audit.record({
      ...meta,
      action: 'auth.password_reset',
      actor: user,
      summary: 'Đặt lại mật khẩu bằng mã gửi qua email',
      target: { id: userId, label: user?.name ?? userId, type: 'account' },
    });
    return withMessage(
      null,
      'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.',
      'AUTH.RESET_PASSWORD.SUCCESS',
    );
  }

  async refresh(dto: RefreshDto, meta: RequestMeta): Promise<SignedIn> {
    const { data, error } = await this.supabase
      .client()
      .auth.refreshSession({ refresh_token: dto.refreshToken });
    if (error || !data.session || !data.user) {
      throw fromSupabase(error, () =>
        unauthorized(
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          'AUTH.REFRESH.INVALID_TOKEN',
        ),
      );
    }

    // The moment to notice a new role or a locked account: read the profile again.
    const user = await this.users.ensureFromSupabase(data.user, true);
    await this.admit(user, dto.app ?? 'shop', data.session.access_token, meta);
    return this.signedIn(data.session, user);
  }

  async logout(
    user: AuthUser | undefined,
    accessToken: string | undefined,
    meta: RequestMeta,
  ) {
    if (accessToken) await this.signOut(accessToken, 'local');
    if (user) {
      await this.audit.record({
        ...meta,
        action: 'auth.logout',
        actor: user,
        summary: 'Đăng xuất',
        target: { id: user.id, label: user.name, type: 'account' },
      });
    }
    return withMessage(null, 'Đã đăng xuất.', 'AUTH.LOGOUT.SUCCESS');
  }

  async changePassword(
    user: AuthUser,
    dto: ChangePasswordDto,
    accessToken: string,
    meta: RequestMeta,
  ) {
    this.limiter.consume(
      `change-password:${user.id}`,
      ...LIMITS.changePassword,
    );
    if (dto.currentPassword === dto.newPassword) {
      throw badRequest(
        'AUTH.PASSWORD.SAME_PASSWORD',
        'Mật khẩu mới phải khác mật khẩu đang dùng.',
      );
    }

    const check = await this.supabase.client().auth.signInWithPassword({
      email: user.email,
      password: dto.currentPassword,
    });
    if (check.error || !check.data.session) {
      await this.audit.record({
        ...meta,
        action: 'auth.change_password',
        actor: user,
        result: 'failed',
        summary: 'Đổi mật khẩu thất bại: mật khẩu hiện tại không đúng',
        target: { id: user.id, label: user.name, type: 'account' },
      });
      throw badRequest(
        'AUTH.CHANGE_PASSWORD.WRONG_CURRENT_PASSWORD',
        'Mật khẩu hiện tại không đúng.',
      );
    }
    await this.signOut(check.data.session.access_token, 'local');

    const { error } = await this.supabase.admin.auth.admin.updateUserById(
      user.id,
      {
        password: dto.newPassword,
      },
    );
    if (error) {
      throw fromSupabase(error, () =>
        badRequest(
          'AUTH.CHANGE_PASSWORD.FAILED',
          'Chưa đổi được mật khẩu. Vui lòng thử lại.',
        ),
      );
    }

    // Other devices must sign in again with the new password; this one stays signed in.
    await this.signOut(accessToken, 'others');
    this.limiter.reset(`change-password:${user.id}`);
    await this.audit.record({
      ...meta,
      action: 'auth.change_password',
      actor: user,
      summary: 'Đổi mật khẩu',
      target: { id: user.id, label: user.name, type: 'account' },
    });
    return withMessage(
      null,
      'Đã đổi mật khẩu.',
      'AUTH.CHANGE_PASSWORD.SUCCESS',
    );
  }

  async social(
    provider: 'apple' | 'google',
    dto: SocialDto,
    meta: RequestMeta,
  ) {
    const { data, error } = await this.supabase
      .client()
      .auth.signInWithIdToken({
        nonce: dto.nonce,
        provider,
        token: dto.idToken,
      });
    if (error || !data.session || !data.user) {
      const label = provider === 'google' ? 'Google' : 'Apple';
      throw fromSupabase(error, () =>
        [
          'provider_disabled',
          'oauth_provider_not_supported',
          'validation_failed',
        ].includes(supabaseCode(error))
          ? badRequest(
              'AUTH.SOCIAL.DISABLED',
              `Đăng nhập bằng ${label} chưa được bật.`,
            )
          : unauthorized(
              `Chưa đăng nhập được bằng ${label}.`,
              'AUTH.SOCIAL.FAILED',
            ),
      );
    }

    return this.completeSignIn(
      data.session,
      provider === 'google' ? 'Google' : 'Apple',
      meta,
    );
  }

  /**
   * A shop session Supabase opened another way (Google, Apple): checked, recorded and answered
   * like a password sign-in. A first sign-in creates the customer's profile.
   */
  async completeSignIn(
    session: Session,
    method: string,
    meta: RequestMeta,
  ): Promise<SignedIn> {
    const user = await this.users.ensureFromSupabase(session.user, true);
    await this.admit(user, 'shop', session.access_token, meta);
    await this.recordSignIn(user, `Đăng nhập cửa hàng bằng ${method}`, meta);
    return this.signedIn(session, user);
  }

  /** Both writes at once: each is a round trip to a database far away. */
  private async recordSignIn(
    user: AuthUser,
    summary: string,
    meta: RequestMeta,
  ) {
    await Promise.all([
      this.prisma.user.update({
        data: { lastLoginAt: new Date() },
        where: { id: user.id },
      }),
      this.audit.record({
        ...meta,
        action: 'auth.login',
        actor: user,
        summary,
        target: { id: user.id, label: user.name, type: 'account' },
      }),
    ]);
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
      where: { id: user.id },
    });
    if (dto.name !== undefined) {
      // Keep Supabase's copy of the name in step (emails greet people by it).
      await this.supabase.admin.auth.admin
        .updateUserById(user.id, { user_metadata: { name: dto.name } })
        .catch(() => undefined);
    }
    this.users.invalidate(user.id);
    return withMessage(
      await this.users.get(user.id, true),
      'Đã lưu thông tin tài khoản.',
      'AUTH.PROFILE.UPDATED',
    );
  }

  /**
   * Whether this person may use this app now. A refusal also ends the session Supabase just
   * opened, so a token for an app the person cannot use is never left behind.
   */
  private async admit(
    user: AuthUser,
    app: ClientApp,
    accessToken: string,
    meta: RequestMeta,
  ) {
    let refusal: AppException | null = null;

    if (!user.active) {
      refusal = forbidden(
        'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.',
        'AUTH.LOGIN.ACCOUNT_DISABLED',
      );
    } else if (app !== 'shop' && !canUseApp(user.permissions, app)) {
      refusal = forbidden(
        `Tài khoản này không có quyền vào ${APP_NAMES[app]}.`,
        'AUTH.INSUFFICIENT_PERMISSIONS',
      );
    }
    if (!refusal) return;

    await this.signOut(accessToken, 'local');
    await this.audit.record({
      ...meta,
      action: 'auth.login_denied',
      actor: user,
      result: 'denied',
      summary: user.active
        ? `Không có quyền vào ${APP_NAMES[app]}`
        : `Đăng nhập ${APP_NAMES[app]} bị chặn: tài khoản đã khoá`,
      target: { id: user.id, label: user.name, type: 'account' },
    });
    throw refusal;
  }

  private async signOut(
    accessToken: string,
    scope: 'global' | 'local' | 'others',
  ) {
    if (!accessToken) return;
    await this.supabase.admin.auth.admin
      .signOut(accessToken, scope)
      .catch(() => undefined);
  }

  private signedIn(session: Session, user: AuthUser): SignedIn {
    const expiresAt = session.expires_at
      ? session.expires_at * 1000
      : Date.now() + session.expires_in * 1000;
    return {
      accessToken: session.access_token,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresIn: session.expires_in,
      refreshToken: session.refresh_token,
      user,
    };
  }
}
