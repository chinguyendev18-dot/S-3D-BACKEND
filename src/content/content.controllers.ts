import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../access/auth-user';
import { CurrentUser, Public, RequirePermissions } from '../access/decorators';
import { Audited } from '../audit/audited';
import { ApiData, ApiPage } from '../openapi/api-data.decorator';
import { ContentService } from './content.service';
import {
  BlogCategoryViewDto,
  BlogPostQueryDto,
  BlogPostViewDto,
  CreateBlogCategoryDto,
  CreateBlogPostDto,
  CreateLegalDocumentDto,
  LegalDocumentViewDto,
  LegalQueryDto,
  UpdateBlogCategoryDto,
  UpdateBlogPostDto,
  UpdateLegalDocumentDto,
} from './dto/content.dto';

const BLOG = 'admin.blog.manage';
const PAGES = 'admin.content.manage';

@Controller()
export class BlogController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get('blog-categories')
  @ApiData(BlogCategoryViewDto, { array: true })
  categories() {
    return this.content.blogCategories();
  }

  @Audited({ action: 'blog_category.created', summary: (name) => `Tạo chuyên mục blog “${name}”`, target: 'blog_category' })
  @Post('blog-categories')
  @RequirePermissions(BLOG)
  @ApiData(BlogCategoryViewDto, { status: 201 })
  createCategory(@Body() dto: CreateBlogCategoryDto) {
    return this.content.createBlogCategory(dto);
  }

  @Audited({ action: 'blog_category.updated', summary: (name) => `Sửa chuyên mục blog “${name}”`, target: 'blog_category' })
  @Patch('blog-categories/:id')
  @RequirePermissions(BLOG)
  @ApiData(BlogCategoryViewDto)
  updateCategory(@Param('id') id: string, @Body() dto: UpdateBlogCategoryDto) {
    return this.content.updateBlogCategory(id, dto);
  }

  /** Its posts stay, without a category. */
  @Audited({ action: 'blog_category.deleted', summary: (id) => `Xoá chuyên mục blog ${id}`, target: 'blog_category' })
  @Delete('blog-categories/:id')
  @RequirePermissions(BLOG)
  @ApiData(null)
  removeCategory(@Param('id') id: string) {
    return this.content.removeBlogCategory(id);
  }

  /** Customers see published posts, newest first; staff see drafts too. */
  @Public()
  @Get('blog-posts')
  @ApiPage(BlogPostViewDto)
  posts(@Query() query: BlogPostQueryDto, @CurrentUser() user?: AuthUser) {
    return this.content.blogPosts(query, user);
  }

  /** By id or slug. */
  @Public()
  @Get('blog-posts/:id')
  @ApiData(BlogPostViewDto)
  post(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.content.blogPost(id, user);
  }

  @Audited({ action: 'blog_post.created', summary: (title) => `Viết bài “${title}”`, target: 'blog_post' })
  @Post('blog-categories/:id/blog-posts')
  @RequirePermissions(BLOG)
  @ApiData(BlogPostViewDto, { status: 201 })
  createPost(@Param('id') id: string, @Body() dto: CreateBlogPostDto) {
    return this.content.createBlogPost(id, dto);
  }

  @Audited({ action: 'blog_post.updated', summary: (title) => `Sửa bài “${title}”`, target: 'blog_post' })
  @Patch('blog-categories/:id/blog-posts/:postId')
  @RequirePermissions(BLOG)
  @ApiData(BlogPostViewDto)
  updatePost(@Param('postId') postId: string, @Body() dto: UpdateBlogPostDto) {
    return this.content.updateBlogPost(postId, dto);
  }

  @Audited({ action: 'blog_post.deleted', summary: (id) => `Xoá bài viết ${id}`, target: 'blog_post' })
  @Delete('blog-categories/:id/blog-posts/:postId')
  @RequirePermissions(BLOG)
  @ApiData(null)
  removePost(@Param('postId') postId: string) {
    return this.content.removeBlogPost(postId);
  }
}

/** Policy pages (one section per row) and the FAQ (one question per row). */
@Controller('legal-documents')
export class LegalDocumentsController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get()
  @ApiData(LegalDocumentViewDto, { array: true })
  list(@Query() query: LegalQueryDto) {
    return this.content.legalDocuments(query.type);
  }

  @Public()
  @Get(':id')
  @ApiData(LegalDocumentViewDto)
  get(@Param('id') id: string) {
    return this.content.legalDocument(id);
  }

  @Audited({ action: 'legal_document.created', summary: (title) => `Thêm mục “${title}” (chính sách / FAQ)`, target: 'legal_document' })
  @Post()
  @RequirePermissions(PAGES)
  @ApiData(LegalDocumentViewDto, { status: 201 })
  create(@Body() dto: CreateLegalDocumentDto) {
    return this.content.createLegalDocument(dto);
  }

  @Audited({ action: 'legal_document.updated', summary: (title) => `Sửa mục “${title}” (chính sách / FAQ)`, target: 'legal_document' })
  @Patch(':id')
  @RequirePermissions(PAGES)
  @ApiData(LegalDocumentViewDto)
  update(@Param('id') id: string, @Body() dto: UpdateLegalDocumentDto) {
    return this.content.updateLegalDocument(id, dto);
  }

  @Audited({ action: 'legal_document.deleted', summary: (id) => `Xoá mục ${id} (chính sách / FAQ)`, target: 'legal_document' })
  @Delete(':id')
  @RequirePermissions(PAGES)
  @ApiData(null)
  remove(@Param('id') id: string) {
    return this.content.removeLegalDocument(id);
  }
}
