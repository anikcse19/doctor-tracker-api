import { z } from 'zod';
import { BD_PHONE_REGEX } from '../constants/domain.js';

/** Shared, reusable Zod building blocks for request validation. */

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');
export const idParamsSchema = z.object({ id: objectIdSchema });

const collapseWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

export const nameSchema = z
  .string({ error: 'Name is required' })
  .transform(collapseWhitespace)
  .pipe(z.string().min(2, 'Name must be at least 2 characters').max(100));

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

export const phoneSchema = z
  .string({ error: 'Phone is required' })
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(BD_PHONE_REGEX, 'Enter a valid Bangladeshi mobile number (01XXXXXXXXX)'));

/** Optional free-text search. Empty strings become undefined; length is capped. */
export const searchSchema = z
  .string()
  .trim()
  .max(100, 'Search term is too long')
  .optional()
  .transform((value) => (value ? value : undefined));

/** Accepts ISO date or datetime strings from the query string. */
const queryDate = z.coerce.date({ error: 'Invalid date' });

export const SORT_OPTIONS = ['newest', 'oldest', 'name_asc', 'name_desc'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** Common list-query fields: pagination, search, creation-date range and sort. */
export const listQueryShape = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: searchSchema,
  from: queryDate.optional(),
  to: queryDate.optional(),
  sort: z.enum(SORT_OPTIONS).default('newest'),
};

/** Refinement for any schema built from `listQueryShape` (Zod 4 can't extend refined objects). */
export const validDateRange: [
  check: (query: { from?: Date; to?: Date }) => boolean,
  params: { message: string; path: string[] },
] = [
  (query) => !query.from || !query.to || query.from <= query.to,
  { message: '"from" must be on or before "to"', path: ['from'] },
];

/**
 * Multi-value filter from a comma-separated query param: `?gender=male,female`.
 * Empty → undefined (no filter). Capped at 20 values.
 */
export const csvListSchema = <T extends z.ZodType<string, string>>(item: T) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value
        ? [
            ...new Set(
              value
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean),
            ),
          ]
        : undefined,
    )
    .pipe(z.array(item).max(20, 'Too many filter values').optional());

/** Optional text field for updates: empty string means "clear this value" (null). */
export const clearableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value));
