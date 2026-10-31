import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from '../access/auth-user';
import {
  CurrentUser,
  RequireApp,
  RequirePermissions,
} from '../access/decorators';
import { requestMeta } from '../common/request-meta';
import { RolesService } from '../roles/roles.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  UpdateOwnStaffDto,
} from './dto/account.dto';
import { StaffAccountsService } from './staff-accounts.service';

/** The workshop's staff page: workshop roles only, managed by whoever holds workshop.staff.manage. */
@Controller('workshop/staff')
export class WorkshopStaffController {
  constructor(
    private readonly accounts: StaffAccountsService,
    private readonly roles: RolesService,
  ) {}

  @Get()
  @RequireApp('workshop')
  async list(@CurrentUser() actor: AuthUser) {
    const [staff, roles] = await Promise.all([
      this.accounts.list({ scope: 'workshop' }),
      this.roles.list('workshop'),
    ]);
    return {
      canManage: actor.permissions.includes('workshop.staff.manage'),
      roles: roles.map(({ description, id, key, name, permissions }) => ({
        description,
        id,
        key,
        name,
        permissions,
      })),
      staff,
    };
  }

  @Post()
  @RequirePermissions('workshop.staff.manage')
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateAccountDto,
    @Req() request: Request,
  ) {
    return this.accounts.create(actor, dto, requestMeta(request), 'workshop');
  }

  @Patch('me')
  @RequireApp('workshop')
  updateOwn(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateOwnStaffDto,
    @Req() request: Request,
  ) {
    return this.accounts.updateOwn(actor, dto, requestMeta(request));
  }

  @Patch(':id')
  @RequirePermissions('workshop.staff.manage')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @Req() request: Request,
  ) {
    return this.accounts.update(
      actor,
      id,
      dto,
      requestMeta(request),
      'workshop',
    );
  }
}
