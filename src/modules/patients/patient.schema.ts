import { z } from 'zod';
import { GENDERS } from '../../constants/domain.js';
import {
  clearableString,
  csvListSchema,
  emailSchema,
  listQueryShape,
  nameSchema,
  objectIdSchema,
  phoneSchema,
  validDateRange,
} from '../../utils/validation.js';

const MAX_AGE_YEARS = 130;

const dateOfBirthSchema = z.coerce
  .date({ error: 'Enter a valid date of birth' })
  .refine((date) => date <= new Date(), 'Date of birth cannot be in the future')
  .refine((date) => {
    const oldest = new Date();
    oldest.setFullYear(oldest.getFullYear() - MAX_AGE_YEARS);
    return date >= oldest;
  }, 'Enter a realistic date of birth');

/** Normalise "  type 2 diabetes " → "Type 2 diabetes" so filters/analytics don't fragment. */
const conditionSchema = z
  .string({ error: 'Medical condition is required' })
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Medical condition is required')
      .max(100)
      .refine((value) => !value.includes(','), 'Enter a single primary condition (no commas)'),
  )
  .transform((value) => value.charAt(0).toUpperCase() + value.slice(1));

const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .optional()
  .transform((value) => (value ? value : undefined));

/** Body for POST /doctors/:id/patients (doctor comes from the URL). */
export const createPatientSchema = z
  .object({
    name: nameSchema,
    dateOfBirth: dateOfBirthSchema,
    gender: z.enum(GENDERS, { error: 'Select a gender' }),
    phone: phoneSchema,
    email: optionalEmailSchema,
    condition: conditionSchema,
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .strict();

/** Body for PATCH /patients/:id — every field optional; `email`/`notes` can be cleared with "". */
export const updatePatientSchema = z
  .object({
    name: nameSchema,
    dateOfBirth: dateOfBirthSchema,
    gender: z.enum(GENDERS, { error: 'Select a gender' }),
    phone: phoneSchema,
    email: z
      .union([z.literal(''), emailSchema])
      .transform((value) => (value === '' ? null : value)),
    condition: conditionSchema,
    notes: clearableString(1000),
    doctor: objectIdSchema,
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const listPatientsQuerySchema = z
  .object({
    ...listQueryShape,
    condition: csvListSchema(z.string().max(100)),
    gender: csvListSchema(z.enum(GENDERS)),
    doctor: objectIdSchema.optional(),
  })
  .refine(...validDateRange);

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
