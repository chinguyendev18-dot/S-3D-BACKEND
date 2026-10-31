import { Global, Module } from '@nestjs/common';

import { UserContextService } from './user-context.service';

/** Who is calling and what they may do; the guards themselves are registered in AppModule. */
@Global()
@Module({
  providers: [UserContextService],
  exports: [UserContextService],
})
export class AccessModule {}
