import { Injectable } from '@nestjs/common';

import type { AuthUser } from '../access/auth-user';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/app-exception';
import type { RequestMeta } from '../common/request-meta';
import type { Discount } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateDiscountDto,
  DiscountViewDto,
  UpdateDiscountDto,
} from './discounts.dto';

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value ? new Date(value) : null;

const view = (row: Discount): DiscountViewDto => ({
  categoryIds: row.categoryIds,
  channels: row.channels,
  code: row.code,
  createdAt: row.createdAt.toISOString(),
  description: row.description,
  endsAt: row.endsAt?.toISOString() ?? '',
  id: row.id,
  isActive: row.isActive,
  materials: row.materials,
  maxDiscount: row.maxDiscount,
  minOrder: row.minOrder,
  name: row.name,
  perCustomerLimit: row.perCustomerLimit,
  scope: row.scope,
  startsAt: row.startsAt?.toISOString() ?? '',
  type: row.type,
  updatedAt: row.updatedAt.toISOString(),
  usageLimit: row.usageLimit,
  usedCount: row.usedCount,
  value: row.value,
});

/** Discount codes: kept and edited here; checked and counted at checkout from GĐ3. */
@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.discount.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map(view);
  }

  async create(user: AuthUser, dto: CreateDiscountDto, meta: RequestMeta) {
    if (await this.prisma.discount.findUnique({ where: { code: dto.code } }))
      throw conflict('DISCOUNT.CODE_TAKEN', `Mã "${dto.code}" đã có.`);
    const data = this.fields(dto);
    this.check({ ...data, type: dto.type, value: dto.value });
    const row = await this.prisma.discount.create({
      data: {
        ...data,
        code: dto.code,
        name: dto.name.trim(),
        type: dto.type,
        value: dto.value,
      },
    });
    await this.record(
      user,
      meta,
      'discount.created',
      row,
      `Tạo mã giảm giá ${row.code}`,
    );
    return view(row);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateDiscountDto,
    meta: RequestMeta,
  ) {
    const current = await this.find(id);
    if (dto.code && dto.code !== current.code) {
      if (await this.prisma.discount.findUnique({ where: { code: dto.code } }))
        throw conflict('DISCOUNT.CODE_TAKEN', `Mã "${dto.code}" đã có.`);
    }
    const data = {
      ...this.fields(dto),
      code: dto.code,
      name: dto.name?.trim(),
      type: dto.type,
      value: dto.value,
    };
    this.check({ ...current, ...stripUndefined(data) });
    const row = await this.prisma.discount.update({ data, where: { id } });
    await this.record(
      user,
      meta,
      'discount.updated',
      row,
      `Sửa mã giảm giá ${row.code}`,
    );
    return view(row);
  }

  async remove(user: AuthUser, id: string, meta: RequestMeta) {
    const row = await this.find(id);
    await this.prisma.discount.delete({ where: { id } });
    await this.record(
      user,
      meta,
      'discount.deleted',
      row,
      `Xoá mã giảm giá ${row.code}`,
    );
    return null;
  }

  private async find(id: string) {
    const row = await this.prisma.discount.findUnique({ where: { id } });
    if (!row)
      throw notFound('DISCOUNT.NOT_FOUND', 'Không tìm thấy mã giảm giá.');
    return row;
  }

  private fields(dto: UpdateDiscountDto) {
    return {
      categoryIds: dto.categoryIds,
      channels: dto.channels,
      description: dto.description?.trim(),
      endsAt: toDate(dto.endsAt),
      isActive: dto.isActive,
      materials: dto.materials,
      maxDiscount: dto.maxDiscount,
      minOrder: dto.minOrder,
      perCustomerLimit: dto.perCustomerLimit,
      scope: dto.scope,
      startsAt: toDate(dto.startsAt),
      usageLimit: dto.usageLimit,
    };
  }

  private check(discount: {
    endsAt?: Date | null;
    startsAt?: Date | null;
    type?: string;
    value?: number;
  }) {
    if (
      discount.type === 'percent' &&
      (!discount.value || discount.value > 100)
    )
      throw badRequest(
        'DISCOUNT.INVALID',
        'Giảm theo phần trăm phải từ 1 đến 100.',
      );
    if (discount.type === 'fixed' && !discount.value)
      throw badRequest('DISCOUNT.INVALID', 'Nhập số tiền giảm.');
    if (
      discount.startsAt &&
      discount.endsAt &&
      discount.endsAt <= discount.startsAt
    )
      throw badRequest(
        'DISCOUNT.INVALID',
        'Ngày kết thúc phải sau ngày bắt đầu.',
      );
  }

  private record(
    user: AuthUser,
    meta: RequestMeta,
    action: string,
    row: Discount,
    summary: string,
  ) {
    return this.audit.record({
      ...meta,
      action,
      actor: user,
      summary,
      target: { id: row.id, label: row.code, type: 'discount' },
    });
  }
}

function stripUndefined<T extends object>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
