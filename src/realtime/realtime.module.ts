import { Global, Module } from '@nestjs/common';

import { RealtimeTicketService } from './realtime-ticket.service';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/** Global: any module can inject RealtimeService and push to the apps. */
@Global()
@Module({
  controllers: [RealtimeController],
  exports: [RealtimeService],
  providers: [RealtimeGateway, RealtimeService, RealtimeTicketService],
})
export class RealtimeModule {}
