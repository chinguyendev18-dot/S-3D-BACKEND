import { Injectable } from '@nestjs/common';

import { hasPermission, type AuthUser } from '../access/auth-user';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound } from '../common/app-exception';
import type { RequestMeta } from '../common/request-meta';
import { freeSlug } from '../common/slug';
import type { ProductCategory } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import type { ProductCategoryViewDto } from './dto/product-view.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Customers get the categories that have something on sale; staff get all of them. */
  async list(q: string | undefined, user?: AuthUser) {
    const staff = Boolean(user && hasPermission(user, 'admin.products.view'));
    const search = q?.trim();
    const rows = await this.prisma.productCategory.findMany({
      include: {
        _count: {
          select: {
            products: staff ? true : { where: { status: 'dang_ban' } },
          },
        },
        products: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          select: { thumbnail: true },
          take: 1,
          where: { status: 'dang_ban', thumbnail: { not: '' } },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
    });
    return rows
      .filter((row) => staff || row._count.products > 0)
      .map((row) =>
        this.view(row, row._count.products, row.products[0]?.thumbnail),
      );
  }

  async get(idOrSlug: string) {
    const row = await this.prisma.productCategory.findFirst({
      include: { _count: { select: { products: true } } },
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!row) throw this.notFound();
    return this.view(row, row._count.products);
  }

  async create(user: AuthUser, dto: CreateCategoryDto, meta: RequestMeta) {
    const slug = dto.slug
      ? await this.ensureFree(dto.slug)
      : await freeSlug(dto.name, (slug) => this.taken(slug), 'danh-muc');
    const row = await this.prisma.productCategory.create({
      data: {
        description: dto.description?.trim() ?? '',
        name: dto.name.trim(),
        slug,
        sortOrder: dto.sortOrder ?? (await this.prisma.productCategory.count()),
      },
    });
    await this.record(
      user,
      meta,
      'product_category.created',
      row,
      `Tạo danh mục “${row.name}”`,
    );
    return this.view(row, 0);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateCategoryDto,
    meta: RequestMeta,
  ) {
    const current = await this.prisma.productCategory.findUnique({
      where: { id },
    });
    if (!current) throw this.notFound();
    if (dto.slug && dto.slug !== current.slug) await this.ensureFree(dto.slug);
    const row = await this.prisma.productCategory.update({
      data: {
        description: dto.description?.trim(),
        name: dto.name?.trim(),
        slug: dto.slug,
        sortOrder: dto.sortOrder,
      },
      include: { _count: { select: { products: true } } },
      where: { id },
    });
    await this.record(
      user,
      meta,
      'product_category.updated',
      row,
      `Sửa danh mục “${row.name}”`,
    );
    return this.view(row, row._count.products);
  }

  /** Its products stay, without a category. */
  async remove(user: AuthUser, id: string, meta: RequestMeta) {
    const row = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!row) throw this.notFound();
    await this.prisma.productCategory.delete({ where: { id } });
    await this.record(
      user,
      meta,
      'product_category.deleted',
      row,
      `Xoá danh mục “${row.name}”`,
    );
    return null;
  }

  private view(
    row: ProductCategory,
    productCount: number,
    image?: string,
  ): ProductCategoryViewDto {
    return {
      createdAt: row.createdAt.toISOString(),
      description: row.description,
      id: row.id,
      imageUrl: image ? this.storage.mediaUrl(image) : null,
      name: row.name,
      productCount,
      slug: row.slug,
      sortOrder: row.sortOrder,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private notFound() {
    return notFound('PRODUCT_CATEGORY.NOT_FOUND', 'Không tìm thấy danh mục.');
  }

  private async taken(slug: string) {
    return Boolean(
      await this.prisma.productCategory.findUnique({ where: { slug } }),
    );
  }

  private async ensureFree(slug: string) {
    if (await this.taken(slug))
      throw conflict(
        'PRODUCT_CATEGORY.SLUG_TAKEN',
        `Đường dẫn "${slug}" đã có danh mục khác dùng.`,
      );
    return slug;
  }

  private record(
    user: AuthUser,
    meta: RequestMeta,
    action: string,
    row: { id: string; name: string },
    summary: string,
  ) {
    return this.audit.record({
      ...meta,
      action,
      actor: user,
      summary,
      target: { id: row.id, label: row.name, type: 'product_category' },
    });
  }
}
