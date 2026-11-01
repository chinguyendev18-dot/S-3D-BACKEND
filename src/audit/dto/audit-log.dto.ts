import { ApiProperty } from '@nestjs/swagger';

/** Docs and generated types for what /audit-logs answers (rows of audit_logs). */
export class AuditChangeDto {
  from: string;
  label: string;
  to: string;
}

export class AuditLogDto {
  @ApiProperty({ nullable: true, type: String })
  actorEmail: string | null;

  @ApiProperty({ nullable: true, type: String })
  actorId: string | null;

  @ApiProperty({ nullable: true, type: String })
  actorName: string | null;

  @ApiProperty({ format: 'date-time' })
  at: string;

  /** E.g. auth.login, account.updated, role.created. */
  action: string;

  @ApiProperty({ nullable: true, type: () => [AuditChangeDto] })
  changes: AuditChangeDto[] | null;

  id: string;

  @ApiProperty({ nullable: true, type: String })
  ip: string | null;

  @ApiProperty({ enum: ['success', 'failed', 'denied'] })
  result: 'denied' | 'failed' | 'success';

  summary: string;

  @ApiProperty({ nullable: true, type: String })
  targetId: string | null;

  @ApiProperty({ nullable: true, type: String })
  targetLabel: string | null;

  @ApiProperty({ nullable: true, type: String })
  targetType: string | null;

  @ApiProperty({ nullable: true, type: String })
  userAgent: string | null;
}
