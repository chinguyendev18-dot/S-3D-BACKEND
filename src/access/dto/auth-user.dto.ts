import { ApiProperty } from '@nestjs/swagger';

import type { AuthRole, AuthUser } from '../auth-user';

/** Docs and generated types for AuthUser (access/auth-user.ts). */
export class AuthRoleDto implements AuthRole {
  id: string;
  key: string;
  name: string;

  @ApiProperty({ enum: ['admin', 'workshop'] })
  scope: AuthRole['scope'];
}

export class AuthUserDto implements AuthUser {
  active: boolean;
  avatarUrl: string;
  email: string;
  id: string;

  @ApiProperty({ enum: ['customer', 'staff'] })
  kind: AuthUser['kind'];

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  lastLoginAt: string | null;

  name: string;

  /** Permission keys (customers: none). */
  permissions: string[];

  phone: string;

  @ApiProperty({ nullable: true, type: () => AuthRoleDto })
  role: AuthRoleDto | null;
}
