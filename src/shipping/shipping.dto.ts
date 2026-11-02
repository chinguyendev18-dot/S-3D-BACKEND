import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { PageQueryDto } from '../common/dto/page-query.dto';

export const ZONE_TYPES = ['country', 'eu_us', 'row', 'unsupported'] as const;

export class ZoneQueryDto extends PageQueryDto {
  /** The admin sends it for per-product zones; zones are shop-wide here. */
  @IsOptional()
  @IsString()
  productId?: string;
}

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên vùng giao hàng.' })
  @MaxLength(80)
  name: string;

  /** Country codes (VN…). */
  @IsArray()
  @ArrayMinSize(1, { message: 'Chọn ít nhất 1 quốc gia.' })
  @IsString({ each: true })
  countryIds: string[];

  /** VND for the first item of an order. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  firstItemPrice?: number;

  /** VND for each item after the first. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  additionalItemPrice?: number;

  @IsOptional()
  @IsIn(ZONE_TYPES)
  type?: (typeof ZONE_TYPES)[number];

  /** "1-2", "3-5"… */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  estimatedDays?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Ignored: zones are shop-wide (the admin form still sends it). */
  @IsOptional()
  @IsString()
  productId?: string;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

export class CountryViewDto {
  /** The country code: the admin picks countries by id. */
  id: string;
  code: string;
  name: string;
  iso2: string;
  iso3: string;
  currency: string;
}

export class ShippingZoneViewDto {
  id: string;
  name: string;
  code: string;

  @ApiProperty({ enum: ZONE_TYPES })
  type: string;

  countries: CountryViewDto[];
  countryIds: string[];
  firstItemPrice: number;
  additionalItemPrice: number;
  /** Same as firstItemPrice. */
  basePrice: number;
  currency: string;
  estimatedDays: string;
  isActive: boolean;
  sortOrder: number;
  productId: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
