import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** A printer bed or resin tray: the largest piece the workshop prints in one go. */
export class CreatePrintAreaDto {
  @Matches(/^[A-Za-z0-9_-]{1,30}$/, { message: 'Mã bàn in không hợp lệ.' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Nhập tên bàn in.' })
  @MaxLength(60)
  name: string;

  @IsNumber()
  @Min(1)
  widthCm: number;

  @IsNumber()
  @Min(1)
  heightCm: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePrintAreaDto extends PartialType(CreatePrintAreaDto) {}

export class PrintAreaViewDto {
  id: string;
  code: string;
  name: string;
  label: string;
  widthCm: number;
  heightCm: number;
  /** Same as widthCm / heightCm, with the unit, for the admin's tables. */
  width: number;
  height: number;
  unit: string;
  sortOrder: number;
  isActive: boolean;
}
