import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Public, RequirePermissions } from '../access/decorators';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { Audited } from '../audit/audited';
import { ApiData, ApiPage } from '../openapi/api-data.decorator';
import {
  CountryViewDto,
  CreateZoneDto,
  ShippingZoneViewDto,
  UpdateZoneDto,
  ZoneQueryDto,
} from './shipping.dto';
import { ShippingService } from './shipping.service';

/** Zones are edited on the admin's shipping page (orders permission, like the rest of orders). */
const MANAGE = 'admin.orders.manage';

@Controller()
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Public()
  @Get('countries')
  @ApiPage(CountryViewDto)
  countries(@Query() query: PageQueryDto) {
    return this.shipping.countries(query);
  }

  @Public()
  @Get('shipping/zones')
  @ApiPage(ShippingZoneViewDto)
  zones(@Query() query: ZoneQueryDto) {
    return this.shipping.zones(query);
  }

  @Public()
  @Get('shipping/zones/:id')
  @ApiData(ShippingZoneViewDto)
  zone(@Param('id') id: string) {
    return this.shipping.zone(id);
  }

  @Audited({ action: 'shipping_zone.created', summary: (name) => `Tạo vùng giao hàng “${name}”`, target: 'shipping_zone' })
  @Post('shipping/zones')
  @RequirePermissions(MANAGE)
  @ApiData(ShippingZoneViewDto, { status: 201 })
  create(@Body() dto: CreateZoneDto) {
    return this.shipping.createZone(dto);
  }

  @Audited({ action: 'shipping_zone.updated', summary: (name) => `Sửa vùng giao hàng “${name}”`, target: 'shipping_zone' })
  @Patch('shipping/zones/:id')
  @RequirePermissions(MANAGE)
  @ApiData(ShippingZoneViewDto)
  update(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.shipping.updateZone(id, dto);
  }

  @Audited({ action: 'shipping_zone.deleted', summary: (id) => `Xoá vùng giao hàng ${id}`, target: 'shipping_zone' })
  @Delete('shipping/zones/:id')
  @RequirePermissions(MANAGE)
  @ApiData(null)
  remove(@Param('id') id: string) {
    return this.shipping.removeZone(id);
  }
}
