import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PrintMaterialDto {
  /** PLA, PETG, RESIN… */
  @Matches(/^[A-Z0-9_]{2,20}$/, {
    message: 'Mã vật liệu chỉ gồm chữ in hoa, số, dấu gạch dưới.',
  })
  id: string;

  @IsString()
  @MaxLength(40)
  label: string;

  /** g/cm³ */
  @IsNumber()
  @Min(0.1)
  @Max(5)
  density: number;

  @IsNumber()
  @Min(0.05)
  @Max(1)
  fill: number;

  @IsNumber()
  @Min(0.1)
  gramsPerHour: number;

  @IsInt({ message: 'Giá mỗi gram phải là số nguyên (đồng).' })
  @Min(0)
  pricePerGram: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class FilamentDto {
  /** trang, den, xanh-mint… */
  @Matches(/^[a-z0-9-]{1,30}$/, {
    message: 'Mã màu chỉ gồm chữ thường, số và dấu gạch ngang.',
  })
  id: string;

  @IsString()
  @MaxLength(40)
  name: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Mã màu phải dạng #RRGGBB.' })
  hex: string;

  /** Material ids it exists in. */
  @IsArray()
  @ArrayMinSize(1, { message: 'Màu phải dùng được cho ít nhất 1 vật liệu.' })
  @IsString({ each: true })
  materials: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class PrintPricingDto {
  /** VND for each colour beyond the first. */
  @IsInt()
  @Min(0)
  extraColorFee: number;

  @IsInt()
  @Min(0)
  machineRatePerHour: number;

  @IsInt()
  @Min(10)
  @Max(2000)
  maxHeightMm: number;

  @IsInt()
  @IsIn([1, 2, 3, 4, 5, 6, 7, 8])
  maxPrintColors: number;

  @IsInt()
  @Min(1)
  @Max(2000)
  minHeightMm: number;

  @IsInt()
  @Min(0)
  setupFee: number;
}

/** GET /print-options, and what PUT /print-options takes back. */
export class PrintOptionsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 vật liệu.' })
  @ValidateNested({ each: true })
  @Type(() => PrintMaterialDto)
  materials: PrintMaterialDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 màu nhựa.' })
  @ValidateNested({ each: true })
  @Type(() => FilamentDto)
  filaments: FilamentDto[];

  @ValidateNested()
  @Type(() => PrintPricingDto)
  pricing: PrintPricingDto;
}
