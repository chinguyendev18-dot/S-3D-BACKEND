import { Injectable } from '@nestjs/common';

import {
  rolePermissions,
  type AuthRole,
  type AuthUser,
} from '../access/auth-user';
import { SUPER_ADMIN } from '../access/default-roles';
import type { AppScope } from '../access/permissions';
import { UserContextService } from '../access/user-context.service';
import { AuditService, type AuditChange } from '../audit/audit.service';
import { LOCKED_BAN } from '../auth/auth.constants';
import { fromSupabase, supabaseCode } from '../auth/supabase-errors';
import { withMessage } from '../common/api-result';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../common/app-exception';
import type { RequestMeta } from '../common/request-meta';
import {
  Prisma,
  type Role,
  type User,
  type WorkshopProfile,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  AccountQueryDto,
  CreateAccountDto,
  UpdateAccountDto,
  UpdateOwnStaffDto,
  WorkshopProfileDto,
} from './dto/account.dto';

export interface StaffAccountView {
  active: boolean;
  avatarUrl: string;
  createdAt: string;
  email: string;
  id: string;
  lastLoginAt: string | null;
  name: string;
  phone: string;
  role: AuthRole | null;
  updatedAt: string;
  workshop: {
    joinedAt: string;
    note: string;
    shift: string;
    skills: string[];
  } | null;
}

type Row = User & { role: Role | null; workshop: WorkshopProfile | null };

const INCLUDE = { role: true, workshop: true } as const;
const DEFAULT_SHIFT = 'Ca hành chính';
const LEAD_PERMISSION = 'workshop.staff.manage';

const day = (date: Date) => date.toISOString().slice(0, 10);

function toView(row: Row): StaffAccountView {
  return {
    active: row.active,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
    email: row.email,
    id: row.id,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    name: row.name,
    phone: row.phone,
    role: row.role
      ? {
          id: row.role.id,
          key: row.role.key,
          name: row.role.name,
          scope: row.role.scope,
        }
      : null,
    updatedAt: row.updatedAt.toISOString(),
    workshop: row.workshop
      ? {
          joinedAt: day(row.workshop.joinedAt),
          note: row.workshop.note,
          shift: row.workshop.shift,
          skills: row.workshop.skills,
        }
      : null,
  };
}

function workshopData(input?: WorkshopProfileDto) {
  return {
    joinedAt: input?.joinedAt
      ? new Date(`${input.joinedAt}T00:00:00Z`)
      : new Date(),
    note: input?.note ?? '',
    shift: input?.shift || DEFAULT_SHIFT,
    skills: input?.skills ?? [],
  };
}

/** A workshop lead: active, on a workshop role that manages the staff. */
const isLead = (active: boolean, role: Role | null) =>
  active &&
  role?.scope === 'workshop' &&
  rolePermissions(role).includes(LEAD_PERMISSION);

/**
 * Staff accounts (admin site and workshop): the Supabase user and its profile change together.
 * Rules that keep the system manageable: nobody grants or touches more power than they hold,
 * nobody locks or demotes themselves, and the last super admin / workshop lead stays.
 */
@Injectable()
export class StaffAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly users: UserContextService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AccountQueryDto): Promise<StaffAccountView[]> {
    const q = query.q?.trim();
    const rows = await this.prisma.user.findMany({
      include: INCLUDE,
      orderBy: [{ role: { sortOrder: 'asc' } }, { name: 'asc' }],
      where: {
        kind: 'staff',
        ...(query.scope ? { role: { scope: query.scope } } : {}),
        ...(query.active !== undefined ? { active: query.active } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
    });
    return rows.map(toView);
  }

  async create(
    actor: AuthUser,
    dto: CreateAccountDto,
    meta: RequestMeta,
    scope?: AppScope,
  ) {
    const role = await this.roles.find(dto.roleId);
    this.checkScope(role, scope);
    this.checkCanGrant(actor, role);

    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email: dto.email,
      email_confirm: true,
      password: dto.password,
      user_metadata: { name: dto.name },
    });
    if (error || !data.user) {
      throw fromSupabase(error, () =>
        ['email_exists', 'user_already_exists'].includes(supabaseCode(error))
          ? conflict('ACCOUNT.EMAIL_EXISTS', 'Email này đã có tài khoản.')
          : badRequest(
              'ACCOUNT.CREATE_FAILED',
              'Chưa tạo được tài khoản. Vui lòng thử lại.',
            ),
      );
    }

    const active = dto.active ?? true;
    let row: Row;
    try {
      row = await this.prisma.user.create({
        data: {
          active,
          email: dto.email,
          id: data.user.id,
          kind: 'staff',
          name: dto.name,
          phone: dto.phone ?? '',
          roleId: role.id,
          ...(role.scope === 'workshop'
            ? { workshop: { create: workshopData(dto.workshop) } }
            : {}),
        },
        include: INCLUDE,
      });
    } catch (failure) {
      // No half-made account: remove the sign-in again.
      await this.supabase.admin.auth.admin
        .deleteUser(data.user.id)
        .catch(() => undefined);
      if (
        failure instanceof Prisma.PrismaClientKnownRequestError &&
        failure.code === 'P2002'
      ) {
        throw conflict('ACCOUNT.EMAIL_EXISTS', 'Email này đã có tài khoản.');
      }
      throw failure;
    }
    if (!active) await this.setLocked(row.id, true);

    await this.audit.record({
      ...meta,
      action: 'account.create',
      actor,
      changes: [
        { from: '', label: 'Vai trò', to: role.name },
        { from: '', label: 'Email', to: row.email },
      ],
      summary: `Tạo tài khoản ${row.name} (${role.name})`,
      target: { id: row.id, label: row.name, type: 'account' },
    });
    return withMessage(toView(row), 'Đã tạo tài khoản.', 'ACCOUNT.CREATED');
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateAccountDto,
    meta: RequestMeta,
    scope?: AppScope,
  ) {
    const target = await this.prisma.user.findUnique({
      include: INCLUDE,
      where: { id },
    });
    if (
      !target ||
      target.kind !== 'staff' ||
      (scope && target.role?.scope !== scope)
    ) {
      throw notFound('ACCOUNT.NOT_FOUND', 'Không tìm thấy tài khoản.');
    }
    const self = target.id === actor.id;
    if (!self) this.checkCanManage(actor, target);

    const newRole =
      dto.roleId && dto.roleId !== target.roleId
        ? await this.roles.find(dto.roleId)
        : null;
    if (newRole) {
      this.checkScope(newRole, scope);
      this.checkCanGrant(actor, newRole);
    }
    if (self && (newRole || dto.active === false)) {
      throw badRequest(
        'ACCOUNT.SELF_CHANGE',
        'Bạn không thể tự đổi vai trò hoặc tự khoá tài khoản của mình.',
      );
    }
    if (self && dto.password) {
      throw badRequest(
        'ACCOUNT.SELF_PASSWORD',
        'Hãy đổi mật khẩu của chính mình ở mục Đổi mật khẩu (cần mật khẩu hiện tại).',
      );
    }

    const nextRole = newRole ?? target.role;
    const nextActive = dto.active ?? target.active;
    await this.keepSuperAdmin(target, nextRole, nextActive);
    await this.keepWorkshopLead(target, nextRole, nextActive);

    // Supabase first: if it refuses (taken email, weak password), nothing has changed yet.
    const authChanges = {
      ...(dto.email && dto.email !== target.email
        ? { email: dto.email, email_confirm: true }
        : {}),
      ...(dto.password ? { password: dto.password } : {}),
      ...(dto.name && dto.name !== target.name
        ? { user_metadata: { name: dto.name } }
        : {}),
    };
    if (Object.keys(authChanges).length) {
      const { error } = await this.supabase.admin.auth.admin.updateUserById(
        id,
        authChanges,
      );
      if (error) {
        throw fromSupabase(error, () =>
          ['email_exists', 'user_already_exists'].includes(supabaseCode(error))
            ? conflict('ACCOUNT.EMAIL_EXISTS', 'Email này đã có tài khoản.')
            : badRequest(
                'ACCOUNT.UPDATE_FAILED',
                'Chưa lưu được tài khoản. Vui lòng thử lại.',
              ),
        );
      }
    }
    if (nextActive !== target.active) await this.setLocked(id, !nextActive);

    const needsWorkshop =
      nextRole?.scope === 'workshop' && (dto.workshop || !target.workshop);
    let row: Row;
    try {
      row = await this.prisma.user.update({
        data: {
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(newRole ? { roleId: newRole.id } : {}),
          ...(needsWorkshop
            ? {
                workshop: {
                  upsert: {
                    create: workshopData(dto.workshop),
                    update: this.workshopPatch(dto.workshop),
                  },
                },
              }
            : {}),
        },
        include: INCLUDE,
        where: { id },
      });
    } catch (failure) {
      if (
        failure instanceof Prisma.PrismaClientKnownRequestError &&
        failure.code === 'P2002'
      ) {
        throw conflict('ACCOUNT.EMAIL_EXISTS', 'Email này đã có tài khoản.');
      }
      throw failure;
    }
    this.users.invalidate(id);

    await this.audit.record({
      ...meta,
      action: 'account.update',
      actor,
      changes: this.diff(target, row, Boolean(dto.password)),
      summary: `Sửa tài khoản ${row.name}`,
      target: { id, label: row.name, type: 'account' },
    });
    return withMessage(toView(row), 'Đã lưu tài khoản.', 'ACCOUNT.UPDATED');
  }

  async updateOwn(actor: AuthUser, dto: UpdateOwnStaffDto, meta: RequestMeta) {
    const before = await this.prisma.user.findUnique({
      include: INCLUDE,
      where: { id: actor.id },
    });
    if (!before)
      throw notFound('ACCOUNT.NOT_FOUND', 'Không tìm thấy tài khoản.');
    const row = await this.prisma.user.update({
      data: { ...(dto.phone !== undefined ? { phone: dto.phone } : {}) },
      include: INCLUDE,
      where: { id: actor.id },
    });
    this.users.invalidate(actor.id);
    await this.audit.record({
      ...meta,
      action: 'account.update_self',
      actor,
      changes: this.diff(before, row, false),
      summary: 'Cập nhật hồ sơ của mình',
      target: { id: row.id, label: row.name, type: 'account' },
    });
    return withMessage(toView(row), 'Đã lưu hồ sơ.', 'ACCOUNT.UPDATED');
  }

  private workshopPatch(input?: WorkshopProfileDto) {
    return {
      ...(input?.shift !== undefined
        ? { shift: input.shift || DEFAULT_SHIFT }
        : {}),
      ...(input?.skills !== undefined ? { skills: input.skills } : {}),
      ...(input?.joinedAt !== undefined
        ? { joinedAt: new Date(`${input.joinedAt}T00:00:00Z`) }
        : {}),
      ...(input?.note !== undefined ? { note: input.note } : {}),
    };
  }

  /** Locks or unlocks the sign-in itself: a locked account cannot refresh its session either. */
  private async setLocked(id: string, locked: boolean) {
    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      ban_duration: locked ? LOCKED_BAN : 'none',
    });
    if (error) {
      throw fromSupabase(error, () =>
        badRequest(
          'ACCOUNT.LOCK_FAILED',
          'Chưa đổi được trạng thái tài khoản.',
        ),
      );
    }
  }

  private checkScope(role: Role, scope?: AppScope) {
    if (scope && role.scope !== scope) {
      throw badRequest('ROLE.WRONG_SCOPE', 'Vai trò này không dùng cho xưởng.');
    }
  }

  /** Nobody hands out a role with permissions they do not hold themselves. */
  private checkCanGrant(actor: AuthUser, role: Role) {
    const beyond = rolePermissions(role).filter(
      (key) => !actor.permissions.includes(key),
    );
    if (beyond.length) {
      throw forbidden(
        `Bạn không thể giao vai trò “${role.name}” vì nó có quyền bạn không có.`,
      );
    }
  }

  /** Nor changes someone who holds more than they do. */
  private checkCanManage(actor: AuthUser, target: Row) {
    const beyond = rolePermissions(target.role).filter(
      (key) => !actor.permissions.includes(key),
    );
    if (beyond.length) {
      throw forbidden(
        'Tài khoản này có quyền cao hơn bạn nên bạn không sửa được.',
      );
    }
  }

  private async keepSuperAdmin(
    target: Row,
    nextRole: Role | null,
    nextActive: boolean,
  ) {
    const wasOne = target.active && target.role?.key === SUPER_ADMIN;
    const staysOne = nextActive && nextRole?.key === SUPER_ADMIN;
    if (!wasOne || staysOne) return;
    const others = await this.prisma.user.count({
      where: {
        active: true,
        id: { not: target.id },
        role: { key: SUPER_ADMIN },
      },
    });
    if (!others) {
      throw badRequest(
        'ACCOUNT.LAST_SUPER_ADMIN',
        'Hệ thống cần ít nhất một Quản trị hệ thống đang hoạt động.',
      );
    }
  }

  private async keepWorkshopLead(
    target: Row,
    nextRole: Role | null,
    nextActive: boolean,
  ) {
    if (!isLead(target.active, target.role) || isLead(nextActive, nextRole))
      return;
    const candidates = await this.prisma.user.findMany({
      include: { role: true },
      where: {
        active: true,
        id: { not: target.id },
        role: { scope: 'workshop' },
      },
    });
    if (!candidates.some((user) => isLead(user.active, user.role))) {
      throw badRequest(
        'ACCOUNT.LAST_WORKSHOP_LEAD',
        'Xưởng cần ít nhất một tổ trưởng đang làm việc.',
      );
    }
  }

  private diff(before: Row, after: Row, passwordReset: boolean): AuditChange[] {
    const changes: AuditChange[] = [];
    const add = (label: string, from: string, to: string) => {
      if (from !== to) changes.push({ from, label, to });
    };
    add('Họ tên', before.name, after.name);
    add('Email', before.email, after.email);
    add('SĐT', before.phone, after.phone);
    add('Vai trò', before.role?.name ?? '', after.role?.name ?? '');
    add(
      'Trạng thái',
      before.active ? 'Đang hoạt động' : 'Đã khoá',
      after.active ? 'Đang hoạt động' : 'Đã khoá',
    );
    if (before.workshop || after.workshop) {
      add('Ca làm', before.workshop?.shift ?? '', after.workshop?.shift ?? '');
      add(
        'Kỹ năng',
        before.workshop?.skills.join(', ') ?? '',
        after.workshop?.skills.join(', ') ?? '',
      );
      add(
        'Ngày vào làm',
        before.workshop ? day(before.workshop.joinedAt) : '',
        after.workshop ? day(after.workshop.joinedAt) : '',
      );
      add('Ghi chú', before.workshop?.note ?? '', after.workshop?.note ?? '');
    }
    if (passwordReset)
      changes.push({ from: '', label: 'Mật khẩu', to: 'Đặt lại' });
    return changes;
  }
}
