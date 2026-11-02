import { ApiProperty } from '@nestjs/swagger';

/** Docs and generated types for what the catalogue answers. */
export class ProductCategoryRefDto {
  id: string;
  name: string;
  slug: string;
}

export class ProductCategoryViewDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;

  /** Products on sale in it (staff: all of them). */
  productCount: number;

  /** The first product's picture, for category tiles. */
  @ApiProperty({ nullable: true, type: String })
  imageUrl: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** A filament colour a customer can pick for the product. */
export class ProductColorDto {
  id: string;
  name: string;
  label: string;
  hexCode: string;
}

/** A quick-pick height ("h120" = 120 mm). */
export class ProductSizeOptionDto {
  id: string;
  name: string;
  label: string;
  heightMm: number;
  sortOrder: number;
}

export class ProductVariantDto {
  id: string;
  sku: string;
  colorId: string;
  sizeId: string;

  @ApiProperty({ nullable: true, type: Number })
  price: number | null;

  stock: number;
  isAvailable: boolean;
  imageUrl: string;
}

export class ModelSizeViewDto {
  x: number;
  y: number;
  z: number;
}

export class ModelMetricsViewDto {
  size: ModelSizeViewDto;
  volume: number;
}

/** Everything the price and the colour / height pickers are worked out from. */
export class PrintTemplateDto {
  colors: string[];

  @ApiProperty({ nullable: true, type: Number })
  comparePrice: number | null;

  defaultColor: string;
  defaultHeightMm: number;
  defaultMaterial: string;

  @ApiProperty({ nullable: true, type: Number })
  fixedPrice: number | null;

  materials: string[];
  maxHeightMm: number;

  @ApiProperty({ nullable: true, type: () => ModelMetricsViewDto })
  metrics: ModelMetricsViewDto | null;

  minHeightMm: number;

  @ApiProperty({ enum: ['tu_dong', 'co_dinh'] })
  priceMode: 'co_dinh' | 'tu_dong';

  @ApiProperty({ enum: ['x', 'y', 'z'] })
  upAxis: 'x' | 'y' | 'z';
}

export class ProductViewDto {
  id: string;
  slug: string;
  sku: string;
  name: string;

  /** One line (plain text), for cards. */
  description: string;
  shortDesc: string;

  /** HTML, for the product page. */
  longDescription: string;

  @ApiProperty({ nullable: true, type: String })
  categoryId: string | null;

  @ApiProperty({ nullable: true, type: String })
  productCategoryId: string | null;

  categoryName: string;

  @ApiProperty({ nullable: true, type: () => ProductCategoryRefDto })
  productCategory: ProductCategoryRefDto | null;

  @ApiProperty({ nullable: true, type: () => ProductCategoryRefDto })
  category: ProductCategoryRefDto | null;

  @ApiProperty({ enum: ['nhap', 'dang_ban', 'an'] })
  status: 'an' | 'dang_ban' | 'nhap';

  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  tags: string[];

  /** VND, at the default height. */
  price: number;

  @ApiProperty({ nullable: true, type: Number })
  oldPrice: number | null;

  @ApiProperty({ nullable: true, type: Number })
  comparePrice: number | null;

  stock: number;
  remainingQuantity: number;
  material: string;

  thumbnail: string;
  imageUrl: string;
  images: string[];
  gallery: string[];

  @ApiProperty({ enum: ['tu_dong', 'co_dinh'] })
  priceMode: 'co_dinh' | 'tu_dong';

  @ApiProperty({ nullable: true, type: Number })
  fixedPrice: number | null;

  materials: string[];
  defaultMaterial: string;

  /** Filament ids offered (empty: all of the material); the picker's colours are in productColors. */
  colors: string[];

  defaultColor: string;
  defaultHeightMm: number;
  minHeightMm: number;
  maxHeightMm: number;

  @ApiProperty({ enum: ['x', 'y', 'z'] })
  upAxis: 'x' | 'y' | 'z';

  @ApiProperty({ nullable: true, type: () => ModelMetricsViewDto })
  metrics: ModelMetricsViewDto | null;

  modelUrl: string;
  modelFileName: string;
  modelSource: string;
  meshyPrompt: string;
  designId: string;

  template: PrintTemplateDto;
  productColors: ProductColorDto[];
  sizes: ProductSizeOptionDto[];

  /** Detail only (GET /products/:id): every colour × height with its price. */
  @ApiProperty({ required: false, type: () => [ProductVariantDto] })
  variants?: ProductVariantDto[];

  /** Staff only. */
  @ApiProperty({ required: false })
  workshopNote?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
