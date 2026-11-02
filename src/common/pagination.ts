import { badRequest } from './app-exception';
import type { PageQueryDto } from './dto/page-query.dto';

const DEFAULT_PAGE_SIZE = 20;

export interface PageMeta {
  limit: number;
  page: number;
  total: number;
  /** At least 1, so "page 1 of 1" also reads right for an empty list. */
  totalPages: number;
}

/**
 * What every paged list answers (documented with @ApiPage). The counts are given twice, at the
 * top and in `meta`, because the apps' screens were written against both forms.
 */
export type Page<T> = PageMeta & { items: T[]; meta: PageMeta };

export interface PageArgs<Field extends string> {
  limit: number;
  orderBy: Partial<Record<Field, 'asc' | 'desc'>>;
  page: number;
  /** The search text, trimmed; undefined when empty. */
  search?: string;
  skip: number;
  take: number;
}

/**
 * The query of a list turned into Prisma's skip / take / orderBy. Only the listed fields may be
 * sorted by (a column without an index, or a private one, cannot be asked for from outside).
 *
 * @example
 * const args = pageArgs(query, ['createdAt', 'name'], '-createdAt');
 * const [items, total] = await prisma.$transaction([
 *   prisma.product.findMany({ orderBy: args.orderBy, skip: args.skip, take: args.take, where }),
 *   prisma.product.count({ where }),
 * ]);
 * return toPage(items.map(toView), total, args);
 */
export function pageArgs<Field extends string>(
  query: PageQueryDto,
  sortable: readonly Field[],
  defaultSort: Field | `-${Field}`,
): PageArgs<Field> {
  const page = query.page ?? 1;
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const sort = query.sort || defaultSort;
  const field = sort.replace(/^-/, '') as Field;

  if (!sortable.includes(field)) {
    throw badRequest(
      'VALIDATION_ERROR',
      `Không sắp xếp được theo "${field}". Chọn một trong: ${sortable.join(', ')}.`,
    );
  }

  const orderBy = { [field]: sort.startsWith('-') ? 'desc' : 'asc' } as Partial<
    Record<Field, 'asc' | 'desc'>
  >;
  return {
    limit,
    orderBy,
    page,
    search: query.q?.trim() || undefined,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function toPage<T>(
  items: T[],
  total: number,
  args: Pick<PageArgs<string>, 'limit' | 'page'>,
): Page<T> {
  const meta: PageMeta = {
    limit: args.limit,
    page: args.page,
    total,
    totalPages: Math.max(1, Math.ceil(total / args.limit)),
  };
  return { ...meta, items, meta };
}
