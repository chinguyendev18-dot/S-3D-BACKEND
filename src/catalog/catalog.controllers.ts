import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from '../access/auth-user';
import { CurrentUser, Public, RequirePermissions } from '../access/decorators';
import { requestMeta } from '../common/request-meta';
import { ApiData, ApiPage } from '../openapi/api-data.decorator';
import { CategoriesService } from './categories.service';
import {
  CategoryQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';
import { PrintOptionsDto } from './dto/print-options.dto';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductCategoryViewDto, ProductViewDto } from './dto/product-view.dto';
import {
  CreatePrintAreaDto,
  PrintAreaViewDto,
  UpdatePrintAreaDto,
} from './dto/print-area.dto';
import { PrintOptionsService } from './print-options.service';
import { ProductsService } from './products.service';
import { PrintAreasService } from './print-areas.service';

const MANAGE = 'admin.products.manage';

/** Registered before ProductsController: /products/categories must not be read as a product id. */
@Controller('products/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiData(ProductCategoryViewDto, { array: true })
  list(@Query() query: CategoryQueryDto, @CurrentUser() user?: AuthUser) {
    return this.categories.list(query.q, user);
  }

  @Public()
  @Get(':id')
  @ApiData(ProductCategoryViewDto)
  get(@Param('id') id: string) {
    return this.categories.get(id);
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiData(ProductCategoryViewDto, { status: 201 })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCategoryDto,
    @Req() request: Request,
  ) {
    return this.categories.create(user, dto, requestMeta(request));
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiData(ProductCategoryViewDto)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() request: Request,
  ) {
    return this.categories.update(user, id, dto, requestMeta(request));
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @ApiData(null)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.categories.remove(user, id, requestMeta(request));
  }
}

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** On sale only, unless the caller can open the admin's products page. */
  @Public()
  @Get()
  @ApiPage(ProductViewDto)
  list(@Query() query: ProductQueryDto, @CurrentUser() user?: AuthUser) {
    return this.products.list(query, user);
  }

  /** By id or slug, with every colour × height and its price. */
  @Public()
  @Get(':id')
  @ApiData(ProductViewDto)
  get(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.products.get(id, user);
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiData(ProductViewDto, { status: 201 })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductDto,
    @Req() request: Request,
  ) {
    return this.products.create(user, dto, requestMeta(request));
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiData(ProductViewDto)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: Request,
  ) {
    return this.products.update(user, id, dto, requestMeta(request));
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @ApiData(null)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.products.remove(user, id, requestMeta(request));
  }
}

/** The printers' build areas: bed, resin tray. */
@Controller('print-areas')
export class PrintAreasController {
  constructor(private readonly areas: PrintAreasService) {}

  @Public()
  @Get()
  @ApiData(PrintAreaViewDto, { array: true })
  list() {
    return this.areas.list();
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiData(PrintAreaViewDto, { status: 201 })
  create(@Body() dto: CreatePrintAreaDto) {
    return this.areas.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiData(PrintAreaViewDto)
  update(@Param('id') id: string, @Body() dto: UpdatePrintAreaDto) {
    return this.areas.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @ApiData(null)
  remove(@Param('id') id: string) {
    return this.areas.remove(id);
  }
}

/** Materials, filament colours and pricing numbers: what prices and colour pickers come from. */
@Controller('print-options')
export class PrintOptionsController {
  constructor(private readonly options: PrintOptionsService) {}

  @Public()
  @Get()
  @ApiData(PrintOptionsDto)
  get() {
    return this.options.get();
  }

  /** Replaces all of it; materials and colours left out are switched off, not deleted. */
  @Put()
  @RequirePermissions(MANAGE)
  @ApiData(PrintOptionsDto)
  replace(@Body() dto: PrintOptionsDto) {
    return this.options.replace(dto);
  }
}
