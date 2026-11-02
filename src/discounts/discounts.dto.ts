import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const DISCOUNT_TYPES = ['percent', 'fixed', 'free_shipping'] as const;
export const DISCOUNT_SCOPES = ['all', 'category', 'material'] as const;

/** "" means no date: the admin's form sends it for "starts now" / "never ends". */
const ISO_OR_EMPTY = /^$|^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** A discount code as the admin's form sends it (0 = unlimited / no cap). */
export class CreateDiscountDto {
  @Transform(upper)
  @Matches(/^[A-Z0-9_-]{3,30}$/, {
    message: 'Mã giảm giá gồm 3–30 chữ in hoa, số, dấu gạch.',
  })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Nhập tên chương trình.' })
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(DISCOUNT_TYPES, { message: 'Loại giảm giá không hợp lệ.' })
  type: (typeof DISCOUNT_TYPES)[number];

  /** Percent (1–100) or VND; ignored for free shipping. */
  @Type(() => Number)
  @IsInt({ message: 'Giá trị giảm phải là số nguyên.' })
  @Min(0)
  value: number;

  @IsOptional()
  @IsIn(DISCOUNT_SCOPES)
  scope?: (typeof DISCOUNT_SCOPES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usageLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  perCustomerLimit?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(ISO_OR_EMPTY, { message: 'Ngày bắt đầu không hợp lệ.' })
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(ISO_OR_EMPTY, { message: 'Ngày kết thúc không hợp lệ.' })
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiscountDto extends PartialType(CreateDiscountDto) {}

export class DiscountViewDto {
  id: string;
  code: string;
  name: string;
  description: string;

  @ApiProperty({ enum: DISCOUNT_TYPES })
  type: string;

  value: number;

  @ApiProperty({ enum: DISCOUNT_SCOPES })
  scope: string;

  categoryIds: string[];
  materials: string[];
  channels: string[];
  minOrder: number;
  /** 0: no cap. */
  maxDiscount: number;
  /** 0: unlimited. */
  usageLimit: number;
  /** 0: unlimited. */
  perCustomerLimit: number;
  usedCount: number;
  /** ISO date, "" = starts right away. */
  startsAt: string;
  /** ISO date, "" = never ends. */
  endsAt: string;
  isActive: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
