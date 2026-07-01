import { Prisma } from '../generated/prisma/client.js';
import type { SortDirection } from './dto/sort.js';

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 200;

export interface PaginationInput {
  limit?: number;
  offset?: number;
}

export interface PaginationArgs {
  take: number;
  skip: number;
}

export function clampPagination(
  pagination: PaginationInput | undefined,
): PaginationArgs {
  const requestedLimit = pagination?.limit ?? DEFAULT_LIMIT;
  const take = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const skip = Math.max(pagination?.offset ?? 0, 0);
  return { take, skip };
}

export interface SortOptions<TOrder extends string> {
  order: TOrder;
  orderBy: SortDirection;
}

export type SortFieldMap<TOrder extends string, TOrderBy> = Record<
  TOrder,
  (direction: Prisma.SortOrder) => TOrderBy
>;

export function buildOrderBy<TOrder extends string, TOrderBy>(
  fieldMap: SortFieldMap<TOrder, TOrderBy>,
  tiebreaker: TOrderBy,
  defaults: SortOptions<TOrder>,
  options?: SortOptions<TOrder>,
): TOrderBy[] {
  const ordering = options ?? defaults;
  const primary = fieldMap[ordering.order](ordering.orderBy);
  return [primary, tiebreaker];
}
