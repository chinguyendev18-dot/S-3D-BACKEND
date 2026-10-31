import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoleDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Tên vai trò cần ít nhất 2 ký tự.' })
  @MaxLength(60)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsIn(['admin', 'workshop'], { message: 'Chọn vai trò cho Admin hay Xưởng.' })
  scope: 'admin' | 'workshop';

  @IsArray({ message: 'Danh sách quyền không hợp lệ.' })
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Tên vai trò cần ít nhất 2 ký tự.' })
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách quyền không hợp lệ.' })
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions?: string[];
}

export class RoleQueryDto {
  @IsOptional()
  @IsIn(['admin', 'workshop'])
  scope?: 'admin' | 'workshop';
}
