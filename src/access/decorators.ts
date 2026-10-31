import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';

import type { AuthedRequest } from './auth-user';
import type { AppScope } from './permissions';

export const IS_PUBLIC = 's3d:public';
export const PERMISSION_RULE = 's3d:permission-rule';

export type PermissionRule =
  { keys: string[]; mode: 'all' | 'any' } | { app: AppScope; mode: 'app' };

/** No sign-in needed. A valid token, when sent, still identifies the caller. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Needs every one of these permissions. */
export const RequirePermissions = (...keys: string[]) =>
  SetMetadata(PERMISSION_RULE, { keys, mode: 'all' } satisfies PermissionRule);

/** Needs at least one of these permissions. */
export const RequireAnyPermission = (...keys: string[]) =>
  SetMetadata(PERMISSION_RULE, { keys, mode: 'any' } satisfies PermissionRule);

/** Needs any permission of the app (admin site or workshop), i.e. being able to open it. */
export const RequireApp = (app: AppScope) =>
  SetMetadata(PERMISSION_RULE, { app, mode: 'app' } satisfies PermissionRule);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);

/** The raw access token of the request (to sign that session out, for example). */
export const AccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthedRequest>().accessToken,
);
