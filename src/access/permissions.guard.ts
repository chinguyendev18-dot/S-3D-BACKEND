import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { forbidden, unauthorized } from '../common/app-exception';
import type { AuthedRequest } from './auth-user';
import { PERMISSION_RULE, type PermissionRule } from './decorators';
import { canUseApp } from './permissions';

/** Runs after AuthGuard: checks the @RequirePermissions / @RequireAnyPermission / @RequireApp rule. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const rule = this.reflector.getAllAndOverride<PermissionRule | undefined>(
      PERMISSION_RULE,
      [context.getHandler(), context.getClass()],
    );
    if (!rule) return true;

    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw unauthorized();

    const allowed =
      rule.mode === 'app'
        ? canUseApp(user.permissions, rule.app)
        : rule.mode === 'all'
          ? rule.keys.every((key) => user.permissions.includes(key))
          : rule.keys.some((key) => user.permissions.includes(key));

    if (!allowed) throw forbidden();
    return true;
  }
}
