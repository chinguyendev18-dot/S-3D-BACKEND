import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { REALTIME_APPS, type RealtimeApp } from '../realtime.events';

export class RealtimeTicketRequestDto {
  /** The app the socket is for; "shop" when left out. Admin / workshop need access to that app. */
  @ApiProperty({ enum: REALTIME_APPS, required: false })
  @IsOptional()
  @IsIn(REALTIME_APPS, { message: 'Ứng dụng không hợp lệ.' })
  app?: RealtimeApp;
}

export class RealtimeTicketDto {
  /** Pass as `auth: { token }` (or `?token=`) when opening the socket; usable once. */
  token: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;

  /** The socket.io namespace on the backend's origin. */
  namespace: string;
}
