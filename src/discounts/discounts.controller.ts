import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from '../access/auth-user';
import { CurrentUser, RequirePermissions } from '../access/decorators';
import { requestMeta } from '../common/request-meta';
import { ApiData } from '../openapi/api-data.decorator';
import {
  CreateDiscountDto,
  DiscountViewDto,
  UpdateDiscountDto,
} from './discounts.dto';
import { DiscountsService } from './discounts.service';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get()
  @RequirePermissions('admin.discounts.view')
  @ApiData(DiscountViewDto, { array: true })
  list() {
    return this.discounts.list();
  }

  @Post()
  @RequirePermissions('admin.discounts.manage')
  @ApiData(DiscountViewDto, { status: 201 })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDiscountDto,
    @Req() request: Request,
  ) {
    return this.discounts.create(user, dto, requestMeta(request));
  }

  @Patch(':id')
  @RequirePermissions('admin.discounts.manage')
  @ApiData(DiscountViewDto)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
    @Req() request: Request,
  ) {
    return this.discounts.update(user, id, dto, requestMeta(request));
  }

  @Delete(':id')
  @RequirePermissions('admin.discounts.manage')
  @ApiData(null)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.discounts.remove(user, id, requestMeta(request));
  }
}
