import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../access/decorators';
import { ApiData } from '../openapi/api-data.decorator';
import { AuditLogDto } from './dto/audit-log.dto';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Recent sign-ins and account / role changes, newest first. */
  @ApiData(AuditLogDto, { array: true })
  @Get()
  @RequirePermissions('admin.accounts.view')
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
