import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PageQueryDto } from './dto/page-query.dto';
import { pageArgs, toPage } from './pagination';

describe('pagination', () => {
  it('starts on page 1 with 20 rows, sorted the default way', () => {
    expect(pageArgs({}, ['createdAt', 'name'], '-createdAt')).toEqual({
      orderBy: { createdAt: 'desc' },
      page: 1,
      pageSize: 20,
      search: undefined,
      skip: 0,
      take: 20,
    });
  });

  it('reads the page, size, search and sort it is given', () => {
    const args = pageArgs(
      { page: 3, pageSize: 10, q: '  đèn ngủ ', sort: 'name' },
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

  it('counts pages, with at least one', () => {
    expect(toPage([], 0, { page: 1, pageSize: 20 }).pageCount).toBe(1);
    expect(toPage([1, 2], 41, { page: 3, pageSize: 20 })).toEqual({
      items: [1, 2],
      page: 3,
      pageCount: 3,
      pageSize: 20,
      total: 41,
    });
  });

  it('turns query strings into numbers and checks them', async () => {
    const ok = plainToInstance(PageQueryDto, { page: '2', pageSize: '50' });
    expect(await validate(ok)).toHaveLength(0);
    expect(ok).toMatchObject({ page: 2, pageSize: 50 });

    const bad = plainToInstance(PageQueryDto, {
      page: '0',
      pageSize: '500',
      sort: 'name;drop',
    });
    const fields = (await validate(bad)).map((error) => error.property);
    expect(fields.sort()).toEqual(['page', 'pageSize', 'sort']);
  });
});
