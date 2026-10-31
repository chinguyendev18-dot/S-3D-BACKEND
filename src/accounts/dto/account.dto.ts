import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { MIN_PASSWORD } from '../../auth/auth.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** What the workshop keeps about a member of its staff. */
export class WorkshopProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  shift?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  skills?: string[];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày vào làm không hợp lệ.' })
  joinedAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateAccountDto {
  @Transform(trimLower)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Nhập họ tên.' })
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(MIN_PASSWORD, {
    message: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`,
  })
  @MaxLength(128)
  password: string;

  @IsUUID('all', { message: 'Chọn vai trò.' })
  roleId: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkshopProfileDto)
  workshop?: WorkshopProfileDto;
}

export class UpdateAccountDto {
  @IsOptional()
  @Transform(trimLower)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Nhập họ tên.' })
  @MaxLength(120)
  name?: string;

  /** Set by someone who manages accounts: the person's new password (empty: unchanged). */
  @IsOptional()
  @IsString()
  @MinLength(MIN_PASSWORD, {
    message: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`,
  })
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Chọn vai trò.' })
  roleId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkshopProfileDto)
  workshop?: WorkshopProfileDto;
}

export class AccountQueryDto {
  @IsOptional()
  @IsIn(['admin', 'workshop'])
  scope?: 'admin' | 'workshop';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}

/** "Hồ sơ của tôi" in the workshop: what staff may change about themselves. */
export class UpdateOwnStaffDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;
}
