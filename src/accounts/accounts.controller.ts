import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from '../access/auth-user';
import { CurrentUser, RequirePermissions } from '../access/decorators';
import { requestMeta } from '../common/request-meta';
import { ApiData } from '../openapi/api-data.decorator';
import { StaffAccountViewDto } from './dto/account-view.dto';
import {
  AccountQueryDto,
  CreateAccountDto,
  UpdateAccountDto,
} from './dto/account.dto';
import { StaffAccountsService } from './staff-accounts.service';

/** Staff accounts, from the admin site: admin and workshop staff alike. */
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: StaffAccountsService) {}

  @ApiData(StaffAccountViewDto, { array: true })
  @Get()
  @RequirePermissions('admin.accounts.view')
  list(@Query() query: AccountQueryDto) {
    return this.accounts.list(query);
  }

  @ApiData(StaffAccountViewDto, { status: 201 })
  @Post()
  @RequirePermissions('admin.accounts.manage')
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateAccountDto,
    @Req() request: Request,
  ) {
    return this.accounts.create(actor, dto, requestMeta(request));
  }

  @ApiData(StaffAccountViewDto)
  @Patch(':id')
  @RequirePermissions('admin.accounts.manage')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @Req() request: Request,
  ) {
    return this.accounts.update(actor, id, dto, requestMeta(request));
  }
}
