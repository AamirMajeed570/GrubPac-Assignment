/**
 * Unit tests — pagination helper.
 */

import {
  parsePagination,
  toPrismaSkipTake,
  paginate,
} from '../../src/utils/pagination';

describe('parsePagination', () => {
  it('defaults to page=1, limit=20', () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('parses valid page and limit', () => {
    const result = parsePagination({ page: '3', limit: '10' });
    expect(result).toEqual({ page: 3, limit: 10 });
  });

  it('clamps page to minimum of 1', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-5' }).page).toBe(1);
  });

  it('clamps limit to maximum of 100', () => {
    expect(parsePagination({ limit: '999' }).limit).toBe(100);
  });

  it('clamps limit to minimum of 1', () => {
    expect(parsePagination({ limit: '0' }).limit).toBe(1);
  });

  it('handles non-numeric values by falling back to defaults', () => {
    const result = parsePagination({ page: 'abc', limit: 'xyz' });
    expect(result).toEqual({ page: 1, limit: 20 });
  });
});

describe('toPrismaSkipTake', () => {
  it('calculates skip/take for page 1', () => {
    expect(toPrismaSkipTake({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
  });

  it('calculates skip/take for page 2', () => {
    expect(toPrismaSkipTake({ page: 2, limit: 20 })).toEqual({ skip: 20, take: 20 });
  });

  it('calculates skip/take for page 3 limit 10', () => {
    expect(toPrismaSkipTake({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });
});

describe('paginate', () => {
  it('wraps data in the standard envelope', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const result = paginate(data, 50, { page: 2, limit: 10 });
    expect(result).toEqual({
      data,
      total: 50,
      page: 2,
      limit: 10,
    });
  });

  it('handles empty results', () => {
    const result = paginate([], 0, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
