/**
 * Offset-based pagination utilities.
 * Returns { skip, take } for Prisma and the standard response envelope.
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Parse and clamp pagination query params.
 * Defaults: page=1, limit=20, max limit=100.
 *
 * Uses explicit NaN check instead of `|| default` to correctly handle
 * valid values like 0 (which would be falsy but is a valid parsed int).
 */
export function parsePagination(query: {
  page?: unknown;
  limit?: unknown;
}): PaginationParams {
  const rawPage = parseInt(String(query.page ?? ''), 10);
  const rawLimit = parseInt(String(query.limit ?? ''), 10);

  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));

  return { page, limit };
}

/**
 * Convert page/limit to Prisma skip/take.
 */
export function toPrismaSkipTake(params: PaginationParams): {
  skip: number;
  take: number;
} {
  return {
    skip: (params.page - 1) * params.limit,
    take: params.limit,
  };
}

/**
 * Build the standard paginated JSON envelope.
 */
export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
  };
}
