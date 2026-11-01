import {
  SetMetadata,
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

import type { AuthedRequest } from './auth-user';
import type { AppScope } from './permissions';

export const IS_PUBLIC = 's3d:public';
export const PERMISSION_RULE = 's3d:permission-rule';

/** OpenAPI extensions the API docs read (see openapi/openapi.ts): who may call an operation. */
export const DOC_PUBLIC = 'x-s3d-public';
export const DOC_RULE = 'x-s3d-rule';

export type PermissionRule =
  { keys: string[]; mode: 'all' | 'any' } | { app: AppScope; mode: 'app' };

const rule = (value: PermissionRule) =>
  applyDecorators(
    SetMetadata(PERMISSION_RULE, value),
    ApiExtension(DOC_RULE, value),
  );

/** No sign-in needed. A valid token, when sent, still identifies the caller. */
export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC, true), ApiExtension(DOC_PUBLIC, true));

/** Needs every one of these permissions. */
export const RequirePermissions = (...keys: string[]) =>
  rule({ keys, mode: 'all' });

/** Needs at least one of these permissions. */
export const RequireAnyPermission = (...keys: string[]) =>
  rule({ keys, mode: 'any' });

/** Needs any permission of the app (admin site or workshop), i.e. being able to open it. */
export const RequireApp = (app: AppScope) => rule({ app, mode: 'app' });

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);

/** The raw access token of the request (to sign that session out, for example). */
export const AccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthedRequest>().accessToken,
);
