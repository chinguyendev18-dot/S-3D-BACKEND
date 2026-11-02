import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_PAGE_SIZE = 100;

/**
 * `?page=1&limit=20&q=…&sort=-createdAt` for every list. Extend it with the list's own filters;
 * read it with pageArgs() (common/pagination.ts).
 */
export class PageQueryDto {
  /** From 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang bắt đầu từ 1.' })
  page?: number;

  /** Rows per page: 1–100, 20 when left out. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số dòng mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Mỗi trang có ít nhất 1 dòng.' })
  @Max(MAX_PAGE_SIZE, {
    message: `Mỗi trang có nhiều nhất ${MAX_PAGE_SIZE} dòng.`,
  })
  limit?: number;

  /** Search text. */
  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm không hợp lệ.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100, { message: 'Từ khoá tìm kiếm tối đa 100 ký tự.' })
  q?: string;

  /** A field to sort by, "-" first for newest / largest first: `-createdAt`, `name`. */
  @IsOptional()
  @Matches(/^-?[a-zA-Z][a-zA-Z0-9]*$/, {
    message: 'Cách sắp xếp không hợp lệ.',
  })
  sort?: string;
}
