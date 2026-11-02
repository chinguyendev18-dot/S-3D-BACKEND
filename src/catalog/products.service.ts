import { Injectable } from '@nestjs/common';

import { hasPermission, type AuthUser } from '../access/auth-user';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/app-exception';
import { pageArgs, toPage } from '../common/pagination';
import type { RequestMeta } from '../common/request-meta';
import { freeSlug } from '../common/slug';
import { Prisma, type Product } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { PrintOptionsDto } from './dto/print-options.dto';
import type {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { PrintOptionsService } from './print-options.service';
import { pricedProduct, productView, type ProductRow } from './product-view';
import { priceAt } from './pricing';

const SORTABLE = [
  'createdAt',
  'updatedAt',
  'price',
  'name',
  'sortOrder',
] as const;
const INCLUDE = { category: true } as const;

/** What a save is checked and priced from: the stored product with the changes applied. */
type ProductDraft = Partial<
  Pick<
    Product,
    | 'colors'
    | 'defaultColor'
    | 'defaultHeightMm'
    | 'defaultMaterial'
    | 'fixedPrice'
    | 'materials'
    | 'maxHeightMm'
    | 'minHeightMm'
    | 'priceMode'
    | 'status'
    | 'upAxis'
  >
> & { metrics?: unknown };

const isStaff = (user?: AuthUser) =>
  Boolean(user && hasPermission(user, 'admin.products.view'));

const notFoundProduct = () =>
  notFound('PRODUCT.NOT_FOUND', 'Không tìm thấy sản phẩm.');

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly printOptions: PrintOptionsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Customers see products on sale; staff with the products page see drafts and hidden ones too. */
  async list(query: ProductQueryDto, user?: AuthUser) {
    const args = pageArgs(query, SORTABLE, 'sortOrder');
    const staff = isStaff(user);
    const categoryId = query.productCategoryId || query.categoryId;
    const where: Prisma.ProductWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(query.featured !== undefined ? { featured: query.featured } : {}),
      ...(args.search
        ? {
            OR: [
              { name: { contains: args.search, mode: 'insensitive' } },
              { sku: { contains: args.search, mode: 'insensitive' } },
              { shortDesc: { contains: args.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      status: !staff
        ? 'dang_ban'
        : query.status
          ? query.status
          : query.isActive === true
            ? 'dang_ban'
            : query.isActive === false
              ? { not: 'dang_ban' }
              : undefined,
    };

    const [rows, total, options] = await Promise.all([
      this.prisma.product.findMany({
        include: INCLUDE,
        orderBy: [args.orderBy, { createdAt: 'desc' }, { id: 'asc' }],
        skip: args.skip,
        take: args.take,
        where,
      }),
      this.prisma.product.count({ where }),
      this.printOptions.get(),
    ]);
    return toPage(
      rows.map((row) => this.view(row, options, staff, false)),
      total,
      args,
    );
  }

  /** By id or slug. */
  async get(idOrSlug: string, user?: AuthUser) {
    const staff = isStaff(user);
    const row = await this.prisma.product.findFirst({
      include: INCLUDE,
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!row || (!staff && row.status !== 'dang_ban')) throw notFoundProduct();
    return this.view(row, await this.printOptions.get(), staff, true);
  }

  async find(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id } });
    if (!row) throw notFoundProduct();
    return row;
  }

  async create(user: AuthUser, dto: CreateProductDto, meta: RequestMeta) {
    const options = await this.printOptions.get();
    const slug = dto.slug
      ? await this.ensureFreeSlug(dto.slug)
      : await freeSlug(dto.name, (slug) => this.slugTaken(slug), 'san-pham');
    const sku = dto.sku?.toUpperCase() || (await this.newSku());
    if (await this.prisma.product.findUnique({ where: { sku } }))
      throw conflict(
        'PRODUCT.SKU_TAKEN',
        `Mã SKU "${sku}" đã có sản phẩm khác dùng.`,
      );

    const data = this.fields(dto, options);
    const draft: Prisma.ProductUncheckedCreateInput = {
      ...data,
      name: dto.name.trim(),
      sku,
      slug,
      // Printed to order: a new product can be bought until the workshop says otherwise.
      stock: dto.stock ?? 100,
    };
    this.check(draft as ProductDraft, options);
    const row = await this.prisma.product.create({
      data: {
        ...draft,
        price: this.listPrice(draft as ProductDraft, options, dto.price),
      },
      include: INCLUDE,
    });
    await this.record(
      user,
      meta,
      'product.created',
      row,
      `Tạo sản phẩm “${row.name}”`,
    );
    return this.view(row, options, true, true);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateProductDto,
    meta: RequestMeta,
  ) {
    const current = await this.find(id);
    const options = await this.printOptions.get();
    if (dto.slug && dto.slug !== current.slug)
      await this.ensureFreeSlug(dto.slug);
    if (dto.sku && dto.sku.toUpperCase() !== current.sku) {
      const sku = dto.sku.toUpperCase();
      if (await this.prisma.product.findUnique({ where: { sku } }))
        throw conflict(
          'PRODUCT.SKU_TAKEN',
          `Mã SKU "${sku}" đã có sản phẩm khác dùng.`,
        );
    }

    const changes = this.fields(dto, options);
    const next = {
      ...current,
      ...changes,
      ...(dto.name ? { name: dto.name.trim() } : {}),
      ...(dto.slug ? { slug: dto.slug } : {}),
      ...(dto.sku ? { sku: dto.sku.toUpperCase() } : {}),
    } as Product;
    this.check(next, options);
    const row = await this.prisma.product.update({
      data: {
        ...changes,
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.slug ? { slug: dto.slug } : {}),
        ...(dto.sku ? { sku: dto.sku.toUpperCase() } : {}),
        price: this.listPrice(next, options, dto.price ?? current.price),
      },
      include: INCLUDE,
      where: { id },
    });
    await this.record(
      user,
      meta,
      'product.updated',
      row,
      `Sửa sản phẩm “${row.name}”`,
      [
        ...(current.price !== row.price
          ? [{ from: `${current.price}`, label: 'Giá', to: `${row.price}` }]
          : []),
        ...(current.status !== row.status
          ? [{ from: current.status, label: 'Trạng thái', to: row.status }]
          : []),
      ],
    );
    return this.view(row, options, true, true);
  }

  async remove(user: AuthUser, id: string, meta: RequestMeta) {
    const row = await this.find(id);
    await this.prisma.product.delete({ where: { id } });
    await this.record(
      user,
      meta,
      'product.deleted',
      row,
      `Xoá sản phẩm “${row.name}”`,
    );
    return null;
  }

  private view(
    row: ProductRow,
    options: PrintOptionsDto,
    staff: boolean,
    withVariants: boolean,
  ) {
    return productView(row, {
      media: (stored) => this.storage.mediaUrl(stored),
      options,
      staff,
      withVariants,
    });
  }

  /** The columns a create or update sets, pictures and files reduced to what is stored. */
  private fields(dto: UpdateProductDto, options: PrintOptionsDto) {
    const media = (value: string) => {
      if (/^(data|blob):/i.test(value.trim()))
        throw badRequest(
          'PRODUCT.MEDIA_NOT_UPLOADED',
          'Ảnh hoặc mô hình chưa tải lên xong. Vui lòng thử lưu lại.',
        );
      return this.storage.toStored(value);
    };
    const material =
      dto.material?.trim() ||
      (dto.defaultMaterial
        ? (options.materials.find((item) => item.id === dto.defaultMaterial)
            ?.label ?? dto.defaultMaterial)
        : undefined);

    const data: Prisma.ProductUncheckedUpdateInput = {
      categoryId:
        dto.categoryId === undefined ? undefined : dto.categoryId || null,
      colors: dto.colors,
      defaultColor: dto.defaultColor,
      defaultHeightMm: dto.defaultHeightMm,
      defaultMaterial: dto.defaultMaterial,
      description: dto.description,
      designId: dto.designId,
      featured: dto.featured,
      fixedPrice: dto.fixedPrice,
      images: dto.images?.filter(Boolean).map(media),
      material,
      materials: dto.materials,
      maxHeightMm: dto.maxHeightMm,
      meshyPrompt: dto.meshyPrompt,
      metrics:
        dto.metrics === undefined
          ? undefined
          : dto.metrics === null
            ? Prisma.DbNull
            : (dto.metrics as unknown as Prisma.InputJsonValue),
      minHeightMm: dto.minHeightMm,
      modelFileName: dto.modelFileName,
      modelSource: dto.modelSource,
      modelUrl: dto.modelUrl === undefined ? undefined : media(dto.modelUrl),
      oldPrice: dto.comparePrice,
      priceMode: dto.priceMode,
      shortDesc: dto.shortDesc,
      sortOrder: dto.sortOrder,
      status: dto.status,
      stock: dto.stock,
      tags: dto.tags,
      thumbnail: dto.thumbnail === undefined ? undefined : media(dto.thumbnail),
      upAxis: dto.upAxis,
      workshopNote: dto.workshopNote,
    };
    for (const key of Object.keys(data) as (keyof typeof data)[])
      if (data[key] === undefined) delete data[key];
    return data as Prisma.ProductUncheckedCreateInput;
  }

  /**
   * What is checked on every save: materials, colours and heights the workshop has. A product
   * put on sale also needs what its price is worked out from.
   */
  private check(product: ProductDraft, options: PrintOptionsDto) {
    const materials = product.materials ?? ['PLA'];
    const known = new Set(options.materials.map((material) => material.id));
    const unknown = materials.filter((id) => !known.has(id));
    if (unknown.length)
      throw badRequest(
        'PRODUCT.INVALID',
        `Vật liệu không có ở xưởng: ${unknown.join(', ')}.`,
      );
    if (!materials.length)
      throw badRequest('PRODUCT.INVALID', 'Chọn ít nhất 1 vật liệu.');
    const defaultMaterial = product.defaultMaterial ?? 'PLA';
    if (!materials.includes(defaultMaterial))
      throw badRequest(
        'PRODUCT.INVALID',
        'Vật liệu mặc định phải nằm trong các vật liệu đã chọn.',
      );

    const filaments = new Set(options.filaments.map((filament) => filament.id));
    const unknownColors = (product.colors ?? []).filter(
      (id) => !filaments.has(id),
    );
    if (unknownColors.length)
      throw badRequest(
        'PRODUCT.INVALID',
        `Màu nhựa không có ở xưởng: ${unknownColors.join(', ')}.`,
      );
    if (product.defaultColor && !filaments.has(product.defaultColor))
      throw badRequest('PRODUCT.INVALID', 'Màu mặc định không có ở xưởng.');

    const { maxHeightMm: top, minHeightMm: bottom } = options.pricing;
    const min = product.minHeightMm ?? 40;
    const max = product.maxHeightMm ?? 200;
    const height = product.defaultHeightMm ?? 100;
    if (min > height || height > max || min < bottom || max > top)
      throw badRequest(
        'PRODUCT.INVALID',
        `Chiều cao phải theo thứ tự nhỏ nhất ≤ mặc định ≤ lớn nhất, trong khoảng ${bottom}–${top} mm.`,
      );

    if (product.status === 'dang_ban') {
      if ((product.priceMode ?? 'co_dinh') === 'co_dinh' && !product.fixedPrice)
        throw badRequest(
          'PRODUCT.INVALID',
          'Nhập giá cố định trước khi đăng bán.',
        );
      if (product.priceMode === 'tu_dong' && !product.metrics)
        throw badRequest(
          'PRODUCT.INVALID',
          'Giá tự động cần mô hình 3D để đo thể tích.',
        );
    }
  }

  /** The price lists show: fixed, or the quote at the default height in the default material. */
  private listPrice(
    product: ProductDraft,
    options: PrintOptionsDto,
    fallback = 0,
  ) {
    const material = options.materials.find(
      (item) => item.id === (product.defaultMaterial ?? 'PLA'),
    );
    const price = priceAt(
      pricedProduct({
        defaultHeightMm: 100,
        fixedPrice: null,
        metrics: null,
        priceMode: 'co_dinh',
        upAxis: 'y',
        ...product,
      } as Product),
      product.defaultHeightMm ?? 100,
      material,
      options.pricing,
    );
    return price ?? fallback;
  }

  private async slugTaken(slug: string) {
    return Boolean(await this.prisma.product.findUnique({ where: { slug } }));
  }

  private async ensureFreeSlug(slug: string) {
    if (await this.slugTaken(slug))
      throw conflict(
        'PRODUCT.SLUG_TAKEN',
        `Đường dẫn "${slug}" đã có sản phẩm khác dùng.`,
      );
    return slug;
  }

  private async newSku() {
    for (;;) {
      const sku = `S3D-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      if (!(await this.prisma.product.findUnique({ where: { sku } })))
        return sku;
    }
  }

  private record(
    user: AuthUser,
    meta: RequestMeta,
    action: string,
    row: { id: string; name: string },
    summary: string,
    changes?: { from: string; label: string; to: string }[],
  ) {
    return this.audit.record({
      ...meta,
      action,
      actor: user,
      changes,
      summary,
      target: { id: row.id, label: row.name, type: 'product' },
    });
  }
}
