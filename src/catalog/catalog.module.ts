import { Module } from '@nestjs/common';

import {
  CategoriesController,
  PrintAreasController,
  PrintOptionsController,
  ProductsController,
} from './catalog.controllers';
import { CategoriesService } from './categories.service';
import { PrintOptionsService } from './print-options.service';
import { ProductsService } from './products.service';
import { PrintAreasService } from './print-areas.service';

@Module({
  // Order matters: /products/categories is matched before /products/:id.
  controllers: [
    CategoriesController,
    ProductsController,
    PrintAreasController,
    PrintOptionsController,
  ],
  exports: [PrintOptionsService, ProductsService],
  providers: [
    CategoriesService,
    PrintOptionsService,
    ProductsService,
    PrintAreasService,
  ],
})
export class CatalogModule {}
