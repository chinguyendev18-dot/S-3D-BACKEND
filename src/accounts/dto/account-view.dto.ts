import { ApiProperty } from '@nestjs/swagger';

import { AuthRoleDto } from '../../access/dto/auth-user.dto';
import type { StaffAccountView } from '../staff-accounts.service';

/** Docs and generated types for what /accounts and /workshop/staff answer. */
export class WorkshopInfoDto {
  @ApiProperty({ format: 'date' })
  joinedAt: string;

  note: string;
  shift: string;
  skills: string[];
}

export class StaffAccountViewDto implements StaffAccountView {
  active: boolean;
  avatarUrl: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  email: string;
  id: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  lastLoginAt: string | null;

  name: string;
  phone: string;

  @ApiProperty({ nullable: true, type: () => AuthRoleDto })
  role: AuthRoleDto | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  /** Workshop staff only. */
  @ApiProperty({ nullable: true, type: () => WorkshopInfoDto })
  workshop: WorkshopInfoDto | null;
}

export class WorkshopRoleOptionDto {
  description: string;
  id: string;
  key: string;
  name: string;
  permissions: string[];
}

export class WorkshopStaffDirectoryDto {
  /** Whether the caller may add and edit staff. */
  canManage: boolean;

  roles: WorkshopRoleOptionDto[];
  staff: StaffAccountViewDto[];
}
