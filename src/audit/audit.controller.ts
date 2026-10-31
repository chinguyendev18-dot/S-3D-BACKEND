import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../access/decorators';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Recent sign-ins and account / role changes, newest first. */
  @Get()
  @RequirePermissions('admin.accounts.view')
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
