import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { AppException } from './app-exception';

const DEFAULT_CODES: Partial<Record<number, string>> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTH.UNAUTHORIZED',
  403: 'AUTH.INSUFFICIENT_PERMISSIONS',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
};

function readMessage(body: unknown, fallback: string) {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'message' in body) {
    const message = body.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string')
      return message[0];
  }
  return fallback;
}

/** Errors leave in one shape: `{ success: false, statusCode, message, messageCode, details? }`. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppException) {
      if (exception.retryAfterSeconds) {
        response.setHeader('Retry-After', String(exception.retryAfterSeconds));
      }
      response.status(exception.getStatus()).json({
        success: false,
        statusCode: exception.getStatus(),
        message: exception.message,
        messageCode: exception.messageCode,
        ...(exception.details ? { details: exception.details } : {}),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        success: false,
        statusCode: status,
        message: readMessage(exception.getResponse(), exception.message),
        messageCode: DEFAULT_CODES[status] ?? 'ERROR',
      });
      return;
    }

    // Unknown failures are logged here and never shown to the client as they are.
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Máy chủ gặp lỗi. Vui lòng thử lại sau.',
      messageCode: 'SERVER_ERROR',
    });
  }
}
