import { Injectable, Logger } from '@nestjs/common';

import type { RequestMeta } from '../common/request-meta';
import type { AuditResult, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditChange {
  from: string;
  label: string;
  to: string;
}

export interface AuditEntry extends RequestMeta {
  action: string;
  actor?: { email?: string; id?: string; name?: string } | null;
  changes?: AuditChange[];
  result?: AuditResult;
  summary: string;
  target?: { id: string; label: string; type: string };
}

export interface AuditQuery {
  actorId?: string;
  limit?: number;
  targetId?: string;
}

/** Sign-ins and account changes. Writing never fails the request that caused it. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorEmail: entry.actor?.email,
          actorId: entry.actor?.id,
          actorName: entry.actor?.name,
          changes: entry.changes?.length
            ? (entry.changes as unknown as Prisma.InputJsonValue)
            : undefined,
          ip: entry.ip,
          result: entry.result ?? 'success',
          summary: entry.summary,
          targetId: entry.target?.id,
          targetLabel: entry.target?.label,
          targetType: entry.target?.type,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record ${entry.action}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  list(query: AuditQuery) {
    return this.prisma.auditLog.findMany({
      orderBy: { at: 'desc' },
      take: Math.min(Math.max(query.limit ?? 50, 1), 200),
      where: {
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(query.targetId ? { targetId: query.targetId } : {}),
      },
    });
  }
}
