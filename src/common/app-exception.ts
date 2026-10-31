import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * An error the apps can act on: the HTTP status, a stable `messageCode` they branch on
 * (e.g. AUTH.LOGIN.NOT_VERIFIED opens the code screen) and a Vietnamese message to show.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly messageCode: string,
    message: string,
    readonly details?: Record<string, string[]>,
    /** Sent as Retry-After, for rate limits. */
    readonly retryAfterSeconds?: number,
  ) {
    super({ message, messageCode, ...(details ? { details } : {}) }, status);
  }
}

export const unauthorized = (
  message = 'Bạn cần đăng nhập để tiếp tục.',
  code = 'AUTH.UNAUTHORIZED',
) => new AppException(HttpStatus.UNAUTHORIZED, code, message);

export const forbidden = (
  message = 'Bạn không có quyền thực hiện thao tác này.',
  code = 'AUTH.INSUFFICIENT_PERMISSIONS',
) => new AppException(HttpStatus.FORBIDDEN, code, message);

export const badRequest = (code: string, message: string) =>
  new AppException(HttpStatus.BAD_REQUEST, code, message);

export const notFound = (code: string, message: string) =>
  new AppException(HttpStatus.NOT_FOUND, code, message);

export const conflict = (code: string, message: string) =>
  new AppException(HttpStatus.CONFLICT, code, message);
