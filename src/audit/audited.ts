import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap, type Observable } from 'rxjs';

import type { AuthedRequest } from '../access/auth-user';
import { requestMeta } from '../common/request-meta';
import { AuditService } from './audit.service';

const AUDITED = 'audited';

export interface AuditedSpec {
  /** e.g. "blog_post.created". */
  action: string;
  /** What was changed, e.g. "blog_post". */
  target: string;
  /** The line the log shows, from the thing's name: (label) => `Tạo bài viết “${label}”`. */
  summary: (label: string) => string;
}

type Named = { id?: string; name?: string; title?: string } | null;

/**
 * A staff write that goes into the audit log once it has succeeded (who, from where, what), for
 * the writes whose services do not record themselves. The thing is the answer (its id and name or
 * title); a delete answers nothing, so its id comes from the path.
 */
export const Audited = (spec: AuditedSpec) => SetMetadata(AUDITED, spec);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const spec = this.reflector.get<AuditedSpec | undefined>(
      AUDITED,
      context.getHandler(),
    );
    if (!spec) return next.handle();
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    return next.handle().pipe(
      tap((result: unknown) => {
        const answer = result as Named;
        const params = request.params as Record<string, string | undefined>;
        const id = answer?.id ?? params.postId ?? params.id ?? '';
        const named = answer?.name ?? answer?.title;
        const label = named || id;
        void this.audit.record({
          ...requestMeta(request),
          action: spec.action,
          actor: request.user,
          summary: spec.summary(label),
          ...(id ? { target: { id, label, type: spec.target } } : {}),
        });
      }),
    );
  }
}
