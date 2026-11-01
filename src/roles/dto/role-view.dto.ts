import { ApiProperty } from '@nestjs/swagger';

import type { RoleView } from '../roles.service';

/** Docs and generated types for what /roles and /permissions answer. */
export class RoleViewDto implements RoleView {
  description: string;
  id: string;
  key: string;

  /** super_admin: always every permission, cannot be edited or removed. */
  locked: boolean;

  name: string;
  permissions: string[];

  @ApiProperty({ enum: ['admin', 'workshop'] })
  scope: RoleView['scope'];

  sortOrder: number;
  system: boolean;
  userCount: number;
}

export class PermissionDto {
  group: string;
  key: string;
  label: string;

  @ApiProperty({ enum: ['admin', 'workshop'] })
  scope: 'admin' | 'workshop';
}

export class PermissionGroupDto {
  key: string;
  label: string;
}

export class PermissionCatalogDto {
  groups: PermissionGroupDto[];
  permissions: PermissionDto[];
}
