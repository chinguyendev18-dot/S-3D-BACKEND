import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import type { AuthUser } from '../access/auth-user';
import { CurrentUser } from '../access/decorators';
import { canUseApp } from '../access/permissions';
import { forbidden } from '../common/app-exception';
import { ApiData } from '../openapi/api-data.decorator';
import {
  RealtimeTicketDto,
  RealtimeTicketRequestDto,
} from './dto/realtime.dto';
import { RealtimeTicketService } from './realtime-ticket.service';
import { REALTIME_NAMESPACE } from './realtime.events';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly tickets: RealtimeTicketService) {}

  /** A one-time ticket (60 seconds) to open the realtime socket as the signed-in person. */
  @Post('ticket')
  @HttpCode(200)
  @ApiData(RealtimeTicketDto)
  ticket(
    @CurrentUser() user: AuthUser,
    @Body() dto: RealtimeTicketRequestDto,
  ): RealtimeTicketDto {
    const app = dto.app ?? 'shop';
    if (app !== 'shop' && !canUseApp(user.permissions, app)) throw forbidden();
    return {
      ...this.tickets.issue(user.id, app),
      namespace: REALTIME_NAMESPACE,
    };
  }
}
