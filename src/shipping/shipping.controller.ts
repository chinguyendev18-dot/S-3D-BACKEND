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

  @Post('shipping/zones')
  @RequirePermissions(MANAGE)
  @ApiData(ShippingZoneViewDto, { status: 201 })
  create(@Body() dto: CreateZoneDto) {
    return this.shipping.createZone(dto);
  }

  @Patch('shipping/zones/:id')
  @RequirePermissions(MANAGE)
  @ApiData(ShippingZoneViewDto)
  update(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.shipping.updateZone(id, dto);
  }

  @Delete('shipping/zones/:id')
  @RequirePermissions(MANAGE)
  @ApiData(null)
  remove(@Param('id') id: string) {
    return this.shipping.removeZone(id);
  }
}
