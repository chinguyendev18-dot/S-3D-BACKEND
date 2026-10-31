import { Module } from '@nestjs/common';

import { RateLimiter } from '../common/rate-limiter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OAuthService, RateLimiter],
})
export class AuthModule {}
