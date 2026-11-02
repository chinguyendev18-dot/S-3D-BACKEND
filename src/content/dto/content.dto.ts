import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { PageQueryDto } from '../../common/dto/page-query.dto';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE =
  'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.';

// ---------------------------------------------------------------------------------------------
// Blog

export class CreateBlogCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên chuyên mục.' })
  @MaxLength(80)
  name: string;

  @IsOptional()
  @Matches(SLUG, { message: SLUG_MESSAGE })
  slug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index?: number;
}

export class UpdateBlogCategoryDto extends PartialType(CreateBlogCategoryDto) {}

export class BlogPostQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  blogCategoryId?: string;

  /** The admin sends categoryId. */
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class CreateBlogPostDto {
  @IsString()
  @IsNotEmpty({ message: 'Nhập tiêu đề bài viết.' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @Matches(SLUG, { message: SLUG_MESSAGE })
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** HTML. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;

  /** Cover picture: URL from POST /uploads (purpose blog-image). */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  thumbnail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {
  /** Moves the post to another category. */
  @IsOptional()
  @IsString()
  blogCategoryId?: string | null;
}

export class BlogCountDto {
  posts: number;
}

export class BlogCategoryViewDto {
  id: string;
  name: string;
  slug: string;
  index: number;
  _count: BlogCountDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class BlogCategoryRefDto {
  id: string;
  name: string;
  slug: string;
  index: number;
}

export class BlogPostViewDto {
  id: string;
  title: string;
  slug: string;

  @ApiProperty({ nullable: true, type: String })
  thumbnail: string | null;

  description: string;
  content: string;

  @ApiProperty({ nullable: true, type: String })
  blogCategoryId: string | null;

  @ApiProperty({ nullable: true, type: () => BlogCategoryRefDto })
  blogCategory: BlogCategoryRefDto | null;

  index: number;
  published: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

// ---------------------------------------------------------------------------------------------
// Policies and FAQ

export const LEGAL_TYPES = [
  'terms_of_service',
  'privacy_policy',
  'cookie_policy',
  'ai_content_policy',
  'return_refund_policy',
  'faq',
] as const;
export type LegalType = (typeof LEGAL_TYPES)[number];

export class LegalQueryDto {
  @IsOptional()
  @IsIn(LEGAL_TYPES, { message: 'Loại văn bản không hợp lệ.' })
  type?: LegalType;
}

export class CreateLegalDocumentDto {
  @IsIn(LEGAL_TYPES, { message: 'Loại văn bản không hợp lệ.' })
  type: LegalType;

  @IsString()
  @IsNotEmpty({ message: 'Nhập tiêu đề.' })
  @MaxLength(200)
  title: string;

  /** HTML. */
  @IsString()
  @MaxLength(200_000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value : '',
  )
  content: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateLegalDocumentDto extends PartialType(
  CreateLegalDocumentDto,
) {}

export class LegalDocumentViewDto {
  id: string;

  @ApiProperty({ enum: LEGAL_TYPES })
  type: string;

  title: string;
  content: string;
  sortOrder: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
