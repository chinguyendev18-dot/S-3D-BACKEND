import { createHash, randomBytes } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Session } from '@supabase/supabase-js';

import {
  AppException,
  badRequest,
  unauthorized,
} from '../common/app-exception';
import { clientOrigins } from '../common/client-origins';
import { RateLimiter } from '../common/rate-limiter';
import type { RequestMeta } from '../common/request-meta';
import { SupabaseService } from '../supabase/supabase.service';
import { LIMITS } from './auth.constants';
import { AuthService, type SignedIn } from './auth.service';
import type {
  OAuthExchangeDto,
  OAuthProvider,
  OAuthStartDto,
} from './dto/auth.dto';

const PROVIDER_NAMES: Record<OAuthProvider, string> = {
  apple: 'Apple',
  google: 'Google',
};

const unavailable = () =>
  new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'AUTH.PROVIDER_UNAVAILABLE',
    'Chưa kết nối được máy chủ đăng nhập. Vui lòng thử lại.',
  );

/**
 * "Continue with Google / Apple" through Supabase Auth's OAuth, with PKCE: the customer leaves
 * for the provider's page and Supabase sends them back to the app with a one-time code. The app's
 * server keeps the code verifier between the two steps (an HttpOnly cookie); a stolen code is no
 * use without it.
 */
@Injectable()
export class OAuthService {
  private readonly allowedOrigins: string[];

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auth: AuthService,
    private readonly limiter: RateLimiter,
    config: ConfigService,
  ) {
    this.allowedOrigins = clientOrigins(config);
  }

  async start(dto: OAuthStartDto, meta: RequestMeta) {
    this.limiter.consume(`oauth:${meta.ip ?? ''}`, ...LIMITS.oauth);
    this.checkRedirect(dto.redirectTo);

    const enabled = await this.supabase
      .providerEnabled(dto.provider)
      .catch(() => {
        throw unavailable();
      });
    if (!enabled) {
      throw badRequest(
        'AUTH.SOCIAL.DISABLED',
        `Đăng nhập bằng ${PROVIDER_NAMES[dto.provider]} chưa được bật.`,
      );
    }

    const codeVerifier = randomBytes(48).toString('base64url');
    const params = new URLSearchParams({
      code_challenge: createHash('sha256')
        .update(codeVerifier)
        .digest('base64url'),
      code_challenge_method: 's256',
      provider: dto.provider,
      redirect_to: dto.redirectTo,
    });
    // Google otherwise reuses the account the browser last used, without asking.
    if (dto.provider === 'google') params.set('prompt', 'select_account');

    return {
      codeVerifier,
      url: `${this.supabase.url}/auth/v1/authorize?${params.toString()}`,
    };
  }

  async exchange(dto: OAuthExchangeDto, meta: RequestMeta): Promise<SignedIn> {
    this.limiter.consume(`oauth:${meta.ip ?? ''}`, ...LIMITS.oauth);

    const { data, error } = await this.supabase
      .authApi<Session>('/token?grant_type=pkce', {
        body: { auth_code: dto.code, code_verifier: dto.codeVerifier },
        method: 'POST',
      })
      .catch(() => {
        throw unavailable();
      });
    if (error || !data?.access_token || !data.user) {
      throw unauthorized(
        'Chưa đăng nhập được. Vui lòng thử lại.',
        'AUTH.SOCIAL.FAILED',
      );
    }

    const provider = data.user.app_metadata?.provider as
      OAuthProvider | undefined;
    return this.auth.completeSignIn(
      data,
      (provider && PROVIDER_NAMES[provider]) || 'mạng xã hội',
      meta,
    );
  }

  /** Back only to the apps' own addresses (CLIENT_ORIGINS): never an open redirect. */
  private checkRedirect(redirectTo: string) {
    let origin = '';
    try {
      origin = new URL(redirectTo).origin;
    } catch {
      // Not a URL: refused below.
    }
    if (!this.allowedOrigins.includes(origin)) {
      throw badRequest(
        'AUTH.OAUTH.REDIRECT_NOT_ALLOWED',
        'Địa chỉ quay về sau khi đăng nhập không hợp lệ.',
      );
    }
  }
}
