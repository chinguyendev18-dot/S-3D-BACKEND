import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PageQueryDto } from '../../common/dto/page-query.dto';

export const PRODUCT_STATUSES = ['nhap', 'dang_ban', 'an'] as const;
export type ProductStatusValue = (typeof PRODUCT_STATUSES)[number];

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class ProductQueryDto extends PageQueryDto {
  /** Sent by the storefront and the admin for prices per country; the shop sells in VND only. */
  @IsOptional()
  @IsString()
  countryCode?: string;

  /** A category id (the storefront and the admin send productCategoryId). */
  @IsOptional()
  @IsString()
  productCategoryId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /** Staff only: true = on sale, false = drafts and hidden. Customers always get products on sale. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive phải là true hoặc false.' })
  isActive?: boolean;

  /** Staff only. */
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatusValue;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  featured?: boolean;
}

export class ModelSizeDto {
  @IsNumber()
  @Min(0)
  x: number;

  @IsNumber()
  @Min(0)
  y: number;

  @IsNumber()
  @Min(0)
  z: number;
}

/** Measured from the model file in the admin: size and volume at its original scale. */
export class ModelMetricsDto {
  @ValidateNested()
  @Type(() => ModelSizeDto)
  size: ModelSizeDto;

  @IsNumber()
  @Min(0)
  volume: number;
}

/** A ready-made 3D product, as the admin's product editor sends it. */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên sản phẩm.' })
  @MaxLength(120, { message: 'Tên sản phẩm tối đa 120 ký tự.' })
  name: string;

  /** Made from the name when left out. */
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.',
  })
  @MaxLength(80)
  slug?: string;

  /** Made from the category when left out. */
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{3,40}$/, { message: 'Mã SKU không hợp lệ.' })
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Mô tả ngắn tối đa 200 ký tự.' })
  shortDesc?: string;

  /** HTML. */
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatusValue;

  /** The admin's quote at the default height; the server works it out again. */
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  /** Struck-through "before" price. */
  @IsOptional()
  @IsInt()
  @Min(0)
  comparePrice?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  /** As customers read it ("PLA trắng"); made from the default material when left out. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  material?: string;

  /** Cover picture: URL from POST /uploads (or an R2 key). */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  thumbnail?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsIn(['tu_dong', 'co_dinh'])
  priceMode?: 'co_dinh' | 'tu_dong';

  @IsOptional()
  @IsInt()
  @Min(0)
  fixedPrice?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @IsOptional()
  @IsString()
  defaultMaterial?: string;

  /** Filament ids offered; empty: every filament of the material. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsString()
  defaultColor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultHeightMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minHeightMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxHeightMm?: number;

  @IsOptional()
  @IsIn(['x', 'y', 'z'])
  upAxis?: 'x' | 'y' | 'z';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ModelMetricsDto)
  metrics?: ModelMetricsDto | null;

  /** The 3D model: URL from POST /uploads (purpose product-model). */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  modelUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  modelFileName?: string;

  @IsOptional()
  @IsIn(['meshy', 'tai_len'])
  modelSource?: 'meshy' | 'tai_len';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  meshyPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  designId?: string;

  /** For the workshop only; customers never see it. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  workshopNote?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
