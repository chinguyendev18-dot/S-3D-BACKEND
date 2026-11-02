import { Module } from '@nestjs/common';

import {
  BlogController,
  LegalDocumentsController,
} from './content.controllers';
import { ContentService } from './content.service';

@Module({
  controllers: [BlogController, LegalDocumentsController],
  providers: [ContentService],
})
export class ContentModule {}
