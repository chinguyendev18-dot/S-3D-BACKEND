import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { MIN_PASSWORD } from '../auth.constants';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const CLIENT_APPS = ['shop', 'admin', 'workshop'] as const;
export type ClientApp = (typeof CLIENT_APPS)[number];

export const OTP_PURPOSES = ['account', 'forgotpassword'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

class EmailField {
  @Transform(trimLower)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(254)
  email: string;
}

export class LoginDto extends EmailField {
  @IsString({ message: 'Nhập mật khẩu.' })
  @MinLength(1, { message: 'Nhập mật khẩu.' })
  @MaxLength(128)
  password: string;

  /** Which app is signing in: admin and workshop need a staff role with access to them. */
  @IsOptional()
  @IsIn(CLIENT_APPS, { message: 'Ứng dụng không hợp lệ.' })
  app?: ClientApp;
}

export class RegisterDto extends EmailField {
  @IsString()
  @MinLength(MIN_PASSWORD, {
    message: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`,
  })
  @MaxLength(128)
  password: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  name?: string;

  /** The storefront's spelling of `name`. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  fullname?: string;
}

export class VerifyEmailDto extends EmailField {
  @Transform(trim)
  @Matches(/^\d{6,10}$/, { message: 'Mã xác nhận gồm 6 chữ số.' })
  code: string;

  @IsIn(OTP_PURPOSES, { message: 'Loại mã không hợp lệ.' })
  type: OtpPurpose;
}

export class ResendOtpDto extends EmailField {
  @IsOptional()
  @IsIn(OTP_PURPOSES, { message: 'Loại mã không hợp lệ.' })
  type?: OtpPurpose;
}

export class EmailDto extends EmailField {}

/**
 * A new password after a forgotten one: with the reset token from verify-email, or with the
 * email and its code in one step (the admin site's form).
 */
export class ResetPasswordDto {
  @IsString()
  @MinLength(MIN_PASSWORD, {
    message: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`,
  })
  @MaxLength(128)
  newPassword: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  resetToken?: string;

  @IsOptional()
  @Transform(trimLower)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{6,10}$/, { message: 'Mã xác nhận gồm 6 chữ số.' })
  code?: string;
}

export class RefreshDto {
  @IsString({ message: 'Thiếu mã làm mới phiên.' })
  @MinLength(8, { message: 'Thiếu mã làm mới phiên.' })
  @MaxLength(4096)
  refreshToken: string;

  @IsOptional()
  @IsIn(CLIENT_APPS, { message: 'Ứng dụng không hợp lệ.' })
  app?: ClientApp;
}

export class ChangePasswordDto {
  @IsString({ message: 'Nhập mật khẩu hiện tại.' })
  @MinLength(1, { message: 'Nhập mật khẩu hiện tại.' })
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(MIN_PASSWORD, {
    message: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD} ký tự.`,
  })
  @MaxLength(128)
  newPassword: string;
}

export const OAUTH_PROVIDERS = ['apple', 'google'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** Start of "Continue with Google / Apple": where Supabase should send the customer back. */
export class OAuthStartDto {
  @IsIn(OAUTH_PROVIDERS, { message: 'Cách đăng nhập không hợp lệ.' })
  provider: OAuthProvider;

  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { message: 'Địa chỉ quay về không hợp lệ.' },
  )
  @MaxLength(500)
  redirectTo: string;
}

/** The code Supabase sent back, with the verifier kept since the start. */
export class OAuthExchangeDto {
  @IsString({ message: 'Thiếu mã đăng nhập.' })
  @MinLength(8, { message: 'Thiếu mã đăng nhập.' })
  @MaxLength(2048)
  code: string;

  @Matches(/^[A-Za-z0-9._~-]{43,128}$/, {
    message: 'Phiên đăng nhập không hợp lệ. Vui lòng thử lại.',
  })
  codeVerifier: string;
}

export class SocialDto {
  @IsString({ message: 'Thiếu mã đăng nhập.' })
  @MinLength(10, { message: 'Thiếu mã đăng nhập.' })
  @MaxLength(8192)
  idToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  nonce?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Nhập họ tên.' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;
}
