import { PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CategoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Sent by the storefront; not used (one country). */
  @IsOptional()
  @IsString()
  countryCode?: string;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên danh mục.' })
  @MaxLength(80, { message: 'Tên danh mục tối đa 80 ký tự.' })
  name: string;

  /** Made from the name when left out. */
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.',
  })
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
