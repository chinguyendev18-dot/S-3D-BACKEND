import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { rolePermissions, type AuthUser } from '../access/auth-user';
import { SUPER_ADMIN } from '../access/default-roles';
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  isPermission,
  permissionScope,
  type AppScope,
} from '../access/permissions';
import { UserContextService } from '../access/user-context.service';
import { AuditService } from '../audit/audit.service';
import { withMessage } from '../common/api-result';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../common/app-exception';
import type { RequestMeta } from '../common/request-meta';
import type { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

export interface RoleView {
  description: string;
  id: string;
  key: string;
  /** super_admin: always every permission, cannot be edited or removed. */
  locked: boolean;
  name: string;
  permissions: string[];
  scope: AppScope;
  sortOrder: number;
  system: boolean;
  userCount: number;
}

const toView = (role: Role & { _count?: { users: number } }): RoleView => ({
  description: role.description,
  id: role.id,
  key: role.key,
  locked: role.key === SUPER_ADMIN,
  name: role.name,
  permissions: rolePermissions(role),
  scope: role.scope,
  sortOrder: role.sortOrder,
  system: role.system,
  userCount: role._count?.users ?? 0,
});

function slug(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'role'
  );
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserContextService,
    private readonly audit: AuditService,
  ) {}

  catalog() {
    return {
      groups: Object.entries(PERMISSION_GROUPS).map(([key, label]) => ({
        key,
        label,
      })),
      permissions: PERMISSIONS,
    };
  }

  async list(scope?: AppScope) {
    const roles = await this.prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      where: scope ? { scope } : undefined,
    });
    return roles.map(toView);
  }

  async find(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw notFound('ROLE.NOT_FOUND', 'Không tìm thấy vai trò.');
    return role;
  }

  async create(actor: AuthUser, dto: CreateRoleDto, meta: RequestMeta) {
    const permissions = this.checkPermissions(
      actor,
      dto.scope,
      dto.permissions,
    );
    const role = await this.prisma.role.create({
      data: {
        description: dto.description ?? '',
        key: `${slug(dto.name)}_${randomBytes(3).toString('hex')}`,
        name: dto.name,
        permissions,
        scope: dto.scope,
        sortOrder: 100,
      },
      include: { _count: { select: { users: true } } },
    });
    await this.audit.record({
      ...meta,
      action: 'role.create',
      actor,
      changes: [
        {
          from: '',
          label: 'Quyền',
          to: permissions.join(', ') || '(không có)',
        },
      ],
      summary: `Tạo vai trò ${role.name}`,
      target: { id: role.id, label: role.name, type: 'role' },
    });
    return withMessage(toView(role), 'Đã tạo vai trò.', 'ROLE.CREATED');
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateRoleDto,
    meta: RequestMeta,
  ) {
    const role = await this.find(id);
    if (role.key === SUPER_ADMIN) {
      throw badRequest(
        'ROLE.LOCKED',
        'Vai trò Quản trị hệ thống luôn có toàn quyền và không sửa được.',
      );
    }
    this.checkCanTouch(actor, role);

    const permissions =
      dto.permissions !== undefined
        ? this.checkPermissions(actor, role.scope, dto.permissions)
        : undefined;
    const updated = await this.prisma.role.update({
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(permissions ? { permissions } : {}),
      },
      include: { _count: { select: { users: true } } },
      where: { id },
    });
    // Everyone holding this role sees the change on their next request.
    this.users.invalidate();

    const before = new Set(rolePermissions(role));
    const after = new Set(rolePermissions(updated));
    const added = [...after].filter((key) => !before.has(key));
    const removed = [...before].filter((key) => !after.has(key));
    await this.audit.record({
      ...meta,
      action: 'role.update',
      actor,
      changes: [
        ...(role.name !== updated.name
          ? [{ from: role.name, label: 'Tên', to: updated.name }]
          : []),
        ...(added.length
          ? [{ from: '', label: 'Thêm quyền', to: added.join(', ') }]
          : []),
        ...(removed.length
          ? [{ from: removed.join(', '), label: 'Bỏ quyền', to: '' }]
          : []),
      ],
      summary: `Sửa vai trò ${updated.name}`,
      target: { id, label: updated.name, type: 'role' },
    });
    return withMessage(toView(updated), 'Đã lưu vai trò.', 'ROLE.UPDATED');
  }

  async remove(actor: AuthUser, id: string, meta: RequestMeta) {
    const role = await this.prisma.role.findUnique({
      include: { _count: { select: { users: true } } },
      where: { id },
    });
    if (!role) throw notFound('ROLE.NOT_FOUND', 'Không tìm thấy vai trò.');
    if (role.system) {
      throw badRequest(
        'ROLE.SYSTEM',
        'Vai trò có sẵn của hệ thống không xoá được.',
      );
    }
    this.checkCanTouch(actor, role);
    if (role._count.users > 0) {
      throw conflict(
        'ROLE.IN_USE',
        `Còn ${role._count.users} tài khoản đang giữ vai trò này. Hãy đổi vai trò cho họ trước.`,
      );
    }
    await this.prisma.role.delete({ where: { id } });
    await this.audit.record({
      ...meta,
      action: 'role.remove',
      actor,
      summary: `Xoá vai trò ${role.name}`,
      target: { id, label: role.name, type: 'role' },
    });
    return withMessage(null, 'Đã xoá vai trò.', 'ROLE.REMOVED');
  }

  /**
   * Known keys of the role's app only; and nobody hands out a permission they do not hold
   * themselves (otherwise "manage roles" would be a way to grant yourself anything).
   */
  private checkPermissions(actor: AuthUser, scope: AppScope, keys: string[]) {
    const unique = [...new Set(keys)];
    const unknown = unique.filter((key) => !isPermission(key));
    if (unknown.length) {
      throw badRequest(
        'ROLE.UNKNOWN_PERMISSION',
        `Quyền không tồn tại: ${unknown.join(', ')}`,
      );
    }
    const otherApp = unique.filter((key) => permissionScope(key) !== scope);
    if (otherApp.length) {
      throw badRequest(
        'ROLE.WRONG_SCOPE',
        `Vai trò ${scope === 'admin' ? 'Admin' : 'Xưởng'} không nhận các quyền: ${otherApp.join(', ')}`,
      );
    }
    const notHeld = unique.filter((key) => !actor.permissions.includes(key));
    if (notHeld.length) {
      throw forbidden(
        `Bạn không thể cấp quyền mà mình không có: ${notHeld.join(', ')}`,
      );
    }
    return unique;
  }

  /** A role with more power than yours is not yours to change. */
  private checkCanTouch(actor: AuthUser, role: Role) {
    const beyond = rolePermissions(role).filter(
      (key) => !actor.permissions.includes(key),
    );
    if (beyond.length) {
      throw forbidden(
        'Vai trò này có quyền vượt quá quyền của bạn nên bạn không sửa được.',
      );
    }
  }
}
