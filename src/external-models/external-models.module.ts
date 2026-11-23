import { Module } from '@nestjs/common';

import { UploadsModule } from '../uploads/uploads.module';
import { ExternalModelsController } from './external-models.controller';
import { ExternalModelsService } from './external-models.service';

@Module({
  controllers: [ExternalModelsController],
  imports: [UploadsModule],
  providers: [ExternalModelsService],
})
export class ExternalModelsModule {}
