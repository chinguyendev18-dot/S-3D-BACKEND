import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from '../access/auth-user';
import { AccessToken, CurrentUser, Public } from '../access/decorators';
import { requestMeta } from '../common/request-meta';
import { AuthUserDto } from '../access/dto/auth-user.dto';
import { ApiData } from '../openapi/api-data.decorator';
import {
  OAuthStartResultDto,
  ResetReadyDto,
  SessionDto,
  SignedInDto,
  VerificationRequiredDto,
} from './dto/auth-result.dto';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  OAuthExchangeDto,
  OAuthStartDto,
  RefreshDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  SocialDto,
  UpdateProfileDto,
  VerifyEmailDto,
} from './dto/auth.dto';

enum SocialProvider {
  apple = 'apple',
  google = 'google',
}

/**
 * Sign-in for every app. The web apps call these from their own server (which keeps the tokens
 * in HttpOnly cookies); the mobile app calls them directly and keeps the tokens in SecureStore.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
  ) {}

  @Public()
  @ApiData(SignedInDto)
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, requestMeta(request));
  }

  @Public()
  @ApiData([SignedInDto, VerificationRequiredDto], { status: 201 })
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register(dto, requestMeta(request));
  }

  @Public()
  @ApiData([SignedInDto, ResetReadyDto])
  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() request: Request) {
    return this.auth.verifyEmail(dto, requestMeta(request));
  }

  @Public()
  @ApiData(null)
  @Post('resend-otp')
  @HttpCode(200)
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto);
  }

  @Public()
  @ApiData(null)
  @Post(['send-reset-password', 'forgot-password'])
  @HttpCode(200)
  sendResetPassword(@Body() dto: EmailDto) {
    return this.auth.sendResetPassword(dto);
  }

  @Public()
  @ApiData(null)
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.auth.resetPassword(dto, requestMeta(request));
  }

  @Public()
  @ApiData(SignedInDto)
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto, requestMeta(request));
  }

  /** Public so an expired session can still sign out; a valid token also ends it at Supabase. */
  @Public()
  @ApiData(null)
  @Post('logout')
  @HttpCode(200)
  logout(
    @CurrentUser() user: AuthUser | undefined,
    @AccessToken() token: string | undefined,
    @Req() request: Request,
  ) {
    return this.auth.logout(user, token, requestMeta(request));
  }

  @ApiData(SessionDto)
  @Get('session')
  session(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @ApiData(AuthUserDto)
  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user, dto);
  }

  @ApiData(null)
  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthUser,
    @AccessToken() token: string,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.auth.changePassword(user, dto, token, requestMeta(request));
  }

  /** Google / Apple: the provider's sign-in page, and the code verifier to keep until the end. */
  @Public()
  @ApiData(OAuthStartResultDto)
  @Post('oauth/start')
  @HttpCode(200)
  oauthStart(@Body() dto: OAuthStartDto, @Req() request: Request) {
    return this.oauth.start(dto, requestMeta(request));
  }

  /** Back from Google / Apple: the code and the kept verifier become a session. */
  @Public()
  @ApiData(SignedInDto)
  @Post('oauth/exchange')
  @HttpCode(200)
  oauthExchange(@Body() dto: OAuthExchangeDto, @Req() request: Request) {
    return this.oauth.exchange(dto, requestMeta(request));
  }

  @Public()
  @ApiData(SignedInDto)
  @Post(':provider')
  @HttpCode(200)
  social(
    @Param('provider', new ParseEnumPipe(SocialProvider))
    provider: SocialProvider,
    @Body() dto: SocialDto,
    @Req() request: Request,
  ) {
    return this.auth.social(provider, dto, requestMeta(request));
  }
}
