import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PageQueryDto } from './dto/page-query.dto';
import { pageArgs, toPage } from './pagination';

describe('pagination', () => {
  it('starts on page 1 with 20 rows, sorted the default way', () => {
    expect(pageArgs({}, ['createdAt', 'name'], '-createdAt')).toEqual({
      limit: 20,
      orderBy: { createdAt: 'desc' },
      page: 1,
      search: undefined,
      skip: 0,
      take: 20,
    });
  });

  it('reads the page, size, search and sort it is given', () => {
    const args = pageArgs(
      { limit: 10, page: 3, q: '  đèn ngủ ', sort: 'name' },
      ['createdAt', 'name'],
      '-createdAt',
    );
    expect(args).toMatchObject({
      orderBy: { name: 'asc' },
      search: 'đèn ngủ',
      skip: 20,
      take: 10,
    });
  });

  it('refuses a sort field that is not offered', () => {
    expect(() =>
      pageArgs({ sort: '-passwordHash' }, ['createdAt'], '-createdAt'),
    ).toThrow(/Không sắp xếp được theo "passwordHash"/);
  });

  it('counts pages, with at least one, at the top and in meta', () => {
    expect(toPage([], 0, { limit: 20, page: 1 }).totalPages).toBe(1);
    const meta = { limit: 20, page: 3, total: 41, totalPages: 3 };
    expect(toPage([1, 2], 41, { limit: 20, page: 3 })).toEqual({
      ...meta,
      items: [1, 2],
      meta,
    });
  });

  it('turns query strings into numbers and checks them', async () => {
    const ok = plainToInstance(PageQueryDto, { limit: '50', page: '2' });
    expect(await validate(ok)).toHaveLength(0);
    expect(ok).toMatchObject({ limit: 50, page: 2 });

    const bad = plainToInstance(PageQueryDto, {
      limit: '500',
      page: '0',
      sort: 'name;drop',
    });
    const fields = (await validate(bad)).map((error) => error.property);
    expect(fields.sort()).toEqual(['limit', 'page', 'sort']);
  });
});
