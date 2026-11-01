import { Module } from '@nestjs/common';

import { RateLimiter } from '../common/rate-limiter';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  exports: [UploadsService],
  providers: [UploadsService, RateLimiter],
})
export class UploadsModule {}
