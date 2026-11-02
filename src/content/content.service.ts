import { Injectable } from '@nestjs/common';

import { hasPermission, type AuthUser } from '../access/auth-user';
import { badRequest, conflict, notFound } from '../common/app-exception';
import { pageArgs, toPage } from '../common/pagination';
import { freeSlug } from '../common/slug';
import type {
  BlogCategory,
  BlogPost,
  LegalDocument,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type {
  BlogCategoryViewDto,
  BlogPostQueryDto,
  BlogPostViewDto,
  CreateBlogCategoryDto,
  CreateBlogPostDto,
  CreateLegalDocumentDto,
  LegalDocumentViewDto,
  LegalType,
  UpdateBlogCategoryDto,
  UpdateBlogPostDto,
  UpdateLegalDocumentDto,
} from './dto/content.dto';

const iso = (date: Date) => date.toISOString();

/**
 * What the admin writes and the shop shows besides products: the blog and the policy pages / FAQ. Customers read; staff with the matching permission also see drafts.
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // -------------------------------------------------------------------------------------------
  // Blog

  async blogCategories() {
    const rows = await this.prisma.blogCategory.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: [{ index: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.blogCategoryView(row, row._count.posts));
  }

  async createBlogCategory(dto: CreateBlogCategoryDto) {
    const slug = dto.slug
      ? await this.freeOrConflict(dto.slug, (slug) =>
          this.blogCategorySlugTaken(slug),
        )
      : await freeSlug(
          dto.name,
          (slug) => this.blogCategorySlugTaken(slug),
          'chuyen-muc',
        );
    const row = await this.prisma.blogCategory.create({
      data: {
        index: dto.index ?? (await this.prisma.blogCategory.count()) + 1,
        name: dto.name.trim(),
        slug,
      },
    });
    return this.blogCategoryView(row, 0);
  }

  async updateBlogCategory(id: string, dto: UpdateBlogCategoryDto) {
    const current = await this.prisma.blogCategory.findUnique({
      where: { id },
    });
    if (!current) throw this.missing('BLOG_CATEGORY', 'chuyên mục');
    if (dto.slug && dto.slug !== current.slug)
      await this.freeOrConflict(dto.slug, (slug) =>
        this.blogCategorySlugTaken(slug),
      );
    const row = await this.prisma.blogCategory.update({
      data: { ...dto, name: dto.name?.trim() },
      include: { _count: { select: { posts: true } } },
      where: { id },
    });
    return this.blogCategoryView(row, row._count.posts);
  }

  /** Its posts stay, without a category. */
  async removeBlogCategory(id: string) {
    await this.prisma.blogCategory.delete({ where: { id } }).catch(() => {
      throw this.missing('BLOG_CATEGORY', 'chuyên mục');
    });
    return null;
  }

  async blogPosts(query: BlogPostQueryDto, user?: AuthUser) {
    const staff = Boolean(user && hasPermission(user, 'admin.blog.view'));
    const args = pageArgs(
      query,
      ['createdAt', 'updatedAt', 'index', 'title'],
      '-createdAt',
    );
    const categoryId = query.blogCategoryId || query.categoryId;
    const where: Prisma.BlogPostWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(staff ? {} : { published: true }),
      ...(args.search
        ? {
            OR: [
              { title: { contains: args.search, mode: 'insensitive' } },
              { description: { contains: args.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        include: { category: true },
        orderBy: [args.orderBy, { id: 'asc' }],
        skip: args.skip,
        take: args.take,
        where,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return toPage(
      rows.map((row) => this.blogPostView(row)),
      total,
      args,
    );
  }

  /** By id or slug. */
  async blogPost(idOrSlug: string, user?: AuthUser) {
    const staff = Boolean(user && hasPermission(user, 'admin.blog.view'));
    const row = await this.prisma.blogPost.findFirst({
      include: { category: true },
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!row || (!staff && !row.published))
      throw this.missing('BLOG_POST', 'bài viết');
    return this.blogPostView(row);
  }

  async createBlogPost(categoryId: string, dto: CreateBlogPostDto) {
    await this.blogCategoryOrFail(categoryId);
    const slug = dto.slug
      ? await this.freeOrConflict(dto.slug, (slug) => this.postSlugTaken(slug))
      : await freeSlug(
          dto.title,
          (slug) => this.postSlugTaken(slug),
          'bai-viet',
        );
    const row = await this.prisma.blogPost.create({
      data: {
        categoryId,
        content: dto.content ?? '',
        description: dto.description?.trim() ?? '',
        index:
          dto.index ??
          (await this.prisma.blogPost.count({ where: { categoryId } })) + 1,
        published: dto.published ?? true,
        slug,
        thumbnail: dto.thumbnail ? this.media(dto.thumbnail) : '',
        title: dto.title.trim(),
      },
      include: { category: true },
    });
    return this.blogPostView(row);
  }

  /** The category in the path is not checked: the admin sends a placeholder for posts without one. */
  async updateBlogPost(id: string, dto: UpdateBlogPostDto) {
    const current = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!current) throw this.missing('BLOG_POST', 'bài viết');
    if (dto.slug && dto.slug !== current.slug)
      await this.freeOrConflict(dto.slug, (slug) => this.postSlugTaken(slug));
    if (dto.blogCategoryId) await this.blogCategoryOrFail(dto.blogCategoryId);
    const row = await this.prisma.blogPost.update({
      data: {
        categoryId:
          dto.blogCategoryId === undefined
            ? undefined
            : dto.blogCategoryId || null,
        content: dto.content,
        description: dto.description?.trim(),
        index: dto.index,
        published: dto.published,
        slug: dto.slug,
        thumbnail:
          dto.thumbnail === undefined ? undefined : this.media(dto.thumbnail),
        title: dto.title?.trim(),
      },
      include: { category: true },
      where: { id },
    });
    return this.blogPostView(row);
  }

  async removeBlogPost(id: string) {
    await this.prisma.blogPost.delete({ where: { id } }).catch(() => {
      throw this.missing('BLOG_POST', 'bài viết');
    });
    return null;
  }

  // -------------------------------------------------------------------------------------------
  // Policies and FAQ

  async legalDocuments(type?: LegalType) {
    const rows = await this.prisma.legalDocument.findMany({
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      where: type ? { type } : undefined,
    });
    return rows.map((row) => this.legalView(row));
  }

  async legalDocument(id: string) {
    const row = await this.prisma.legalDocument.findUnique({ where: { id } });
    if (!row) throw this.missing('LEGAL_DOCUMENT', 'văn bản');
    return this.legalView(row);
  }

  async createLegalDocument(dto: CreateLegalDocumentDto) {
    const row = await this.prisma.legalDocument.create({
      data: {
        content: dto.content,
        sortOrder:
          dto.sortOrder ??
          (await this.prisma.legalDocument.count({
            where: { type: dto.type },
          })),
        title: dto.title.trim(),
        type: dto.type,
      },
    });
    return this.legalView(row);
  }

  async updateLegalDocument(id: string, dto: UpdateLegalDocumentDto) {
    await this.legalDocument(id);
    const row = await this.prisma.legalDocument.update({
      data: { ...dto, title: dto.title?.trim() },
      where: { id },
    });
    return this.legalView(row);
  }

  async removeLegalDocument(id: string) {
    await this.legalDocument(id);
    await this.prisma.legalDocument.delete({ where: { id } });
    return null;
  }

  // -------------------------------------------------------------------------------------------

  /** Pictures sent back by the admin: an upload's URL becomes its R2 key. */
  private media(value: string) {
    if (/^(data|blob):/i.test(value.trim()))
      throw badRequest(
        'CONTENT.MEDIA_NOT_UPLOADED',
        'Ảnh chưa tải lên xong. Vui lòng thử lại.',
      );
    return this.storage.toStored(value);
  }

  private mediaUrl(stored: string) {
    return stored ? this.storage.mediaUrl(stored) : '';
  }

  private blogCategoryView(
    row: BlogCategory,
    count: number,
  ): BlogCategoryViewDto {
    return {
      _count: { posts: count },
      createdAt: iso(row.createdAt),
      id: row.id,
      index: row.index,
      name: row.name,
      slug: row.slug,
      updatedAt: iso(row.updatedAt),
    };
  }

  private blogPostView(
    row: BlogPost & { category: BlogCategory | null },
  ): BlogPostViewDto {
    return {
      blogCategory: row.category
        ? {
            id: row.category.id,
            index: row.category.index,
            name: row.category.name,
            slug: row.category.slug,
          }
        : null,
      blogCategoryId: row.categoryId,
      content: row.content,
      createdAt: iso(row.createdAt),
      description: row.description,
      id: row.id,
      index: row.index,
      published: row.published,
      slug: row.slug,
      thumbnail: row.thumbnail ? this.mediaUrl(row.thumbnail) : null,
      title: row.title,
      updatedAt: iso(row.updatedAt),
    };
  }

  private legalView(row: LegalDocument): LegalDocumentViewDto {
    return {
      content: row.content,
      createdAt: iso(row.createdAt),
      id: row.id,
      sortOrder: row.sortOrder,
      title: row.title,
      type: row.type,
      updatedAt: iso(row.updatedAt),
    };
  }

  private async blogCategoryOrFail(id: string) {
    const row = await this.prisma.blogCategory.findUnique({ where: { id } });
    if (!row) throw this.missing('BLOG_CATEGORY', 'chuyên mục');
    return row;
  }

  private missing(code: string, label: string) {
    return notFound(`${code}.NOT_FOUND`, `Không tìm thấy ${label}.`);
  }

  private async freeOrConflict(
    slug: string,
    taken: (slug: string) => Promise<boolean>,
  ) {
    if (await taken(slug))
      throw conflict('CONTENT.SLUG_TAKEN', `Đường dẫn "${slug}" đã được dùng.`);
    return slug;
  }

  private async blogCategorySlugTaken(slug: string) {
    return Boolean(
      await this.prisma.blogCategory.findUnique({ where: { slug } }),
    );
  }

  private async postSlugTaken(slug: string) {
    return Boolean(await this.prisma.blogPost.findUnique({ where: { slug } }));
  }
}
