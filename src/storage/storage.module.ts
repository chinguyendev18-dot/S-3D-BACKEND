import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service';

/** Global: products, blog, returns, AI models… all keep their files through StorageService. */
@Global()
@Module({
  exports: [StorageService],
  providers: [StorageService],
})
export class StorageModule {}
