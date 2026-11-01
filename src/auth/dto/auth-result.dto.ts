import { ApiProperty } from '@nestjs/swagger';

import { AuthUserDto } from '../../access/dto/auth-user.dto';

/** Docs and generated types for what the /auth routes answer. */
export class SignedInDto {
  accessToken: string;

  /** When the access token stops working: refresh before then. */
  @ApiProperty({ format: 'date-time' })
  expiresAt: string;

  /** Seconds the access token lives. */
  expiresIn: number;

  refreshToken: string;
  user: AuthUserDto;
}

export class SessionDto {
  user: AuthUserDto;
}

/** Signed up with email confirmation on: the code screen comes next. */
export class VerificationRequiredDto {
  email: string;

  @ApiProperty({ enum: [true] })
  verificationRequired: true;
}

/** The reset code was right: the new password may be set with this token (15 minutes). */
export class ResetReadyDto {
  @ApiProperty({ enum: [true] })
  resetReady: true;

  resetToken: string;
}

export class OAuthStartResultDto {
  /** Keep it (HttpOnly cookie) until /auth/oauth/exchange. */
  codeVerifier: string;

  /** The provider's sign-in page. */
  url: string;
}
