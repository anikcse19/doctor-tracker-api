import mongoose from 'mongoose';
import type { SortOption } from './validation.js';

/** Escape user input so it is matched literally inside a RegExp (prevents ReDoS / regex injection). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" match across several fields. */
export function buildSearchFilter(search: string | undefined, fields: string[]) {
  if (!search) return {};
  const pattern = new RegExp(escapeRegex(search), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

/**
 * Creation-date range filter. Wrapped in `mongoose.trusted()` because the global
 * `sanitizeFilter` option would otherwise neutralise our own (server-built) operators.
 * The values themselves are already validated Date objects.
 */
export function buildDateRangeFilter(from?: Date, to?: Date) {
  if (!from && !to) return {};
  return {
    createdAt: mongoose.trusted({
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    }),
  };
}

/** Stable sort: `_id` is always the tiebreaker so pages never overlap or skip records. */
export function buildSort(sort: SortOption): Record<string, 1 | -1> {
  switch (sort) {
    case 'oldest':
      return { createdAt: 1, _id: 1 };
    case 'name_asc':
      return { name: 1, _id: 1 };
    case 'name_desc':
      return { name: -1, _id: -1 };
    case 'newest':
    default:
      return { createdAt: -1, _id: -1 };
  }
}
