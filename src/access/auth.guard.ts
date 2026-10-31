import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { forbidden, unauthorized } from '../common/app-exception';
import { SupabaseService } from '../supabase/supabase.service';
import type { AuthedRequest } from './auth-user';
import { IS_PUBLIC } from './decorators';
import { UserContextService } from './user-context.service';

function bearerToken(request: AuthedRequest) {
  const header = request.headers.authorization;
  if (!header) return '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : '';
}

/**
 * Every route needs a valid Supabase access token unless marked @Public(). The token is checked
 * locally (signature, expiry, issuer); the person's role and status come from the database.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly users: UserContextService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerToken(request);

    if (!token) {
      if (isPublic) return true;
      throw unauthorized();
    }

    const claims = await this.supabase.verifyAccessToken(token);
    if (!claims) {
      if (isPublic) return true;
      throw unauthorized(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        'AUTH.TOKEN_EXPIRED',
      );
    }

    const user = await this.users.ensure({
      email: typeof claims.email === 'string' ? claims.email : '',
      id: claims.sub,
      metadata: claims.user_metadata,
    });
    if (!user.active && !isPublic) {
      throw forbidden(
        'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.',
        'AUTH.LOGIN.ACCOUNT_DISABLED',
      );
    }

    request.user = user;
    request.accessToken = token;
    return true;
  }
}
