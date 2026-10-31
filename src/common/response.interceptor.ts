import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import { ApiResult } from './api-result';

/** Every answer has the shape the apps already read: `{ success, data, message? }`. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof ApiResult) {
          const result = value as ApiResult<unknown>;
          return {
            success: true,
            data: result.data ?? null,
            ...(result.message ? { message: result.message } : {}),
            ...(result.messageCode ? { messageCode: result.messageCode } : {}),
          };
        }
        return { success: true, data: value ?? null };
      }),
    );
  }
}
