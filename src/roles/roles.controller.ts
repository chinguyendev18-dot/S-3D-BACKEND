import {
  Body,
  Controller,
  Delete,
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
import {
  CurrentUser,
  RequireAnyPermission,
  RequireApp,
  RequirePermissions,
} from '../access/decorators';
import { requestMeta } from '../common/request-meta';
import { ApiData } from '../openapi/api-data.decorator';
import { PermissionCatalogDto, RoleViewDto } from './dto/role-view.dto';
import { CreateRoleDto, RoleQueryDto, UpdateRoleDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** Every permission with its label and group, to draw the permission matrix. */
  @ApiData(PermissionCatalogDto)
  @Get('permissions')
  @RequireApp('admin')
  catalog() {
    return this.roles.catalog();
  }

  @ApiData(RoleViewDto, { array: true })
  @Get('roles')
  @RequireAnyPermission('admin.accounts.view', 'admin.roles.manage')
  list(@Query() query: RoleQueryDto) {
    return this.roles.list(query.scope);
  }

  @ApiData(RoleViewDto, { status: 201 })
  @Post('roles')
  @RequirePermissions('admin.roles.manage')
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateRoleDto,
    @Req() request: Request,
  ) {
    return this.roles.create(actor, dto, requestMeta(request));
  }

  @ApiData(RoleViewDto)
  @Patch('roles/:id')
  @RequirePermissions('admin.roles.manage')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Req() request: Request,
  ) {
    return this.roles.update(actor, id, dto, requestMeta(request));
  }

  @ApiData(null)
  @Delete('roles/:id')
  @RequirePermissions('admin.roles.manage')
  remove(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ) {
    return this.roles.remove(actor, id, requestMeta(request));
  }
}
