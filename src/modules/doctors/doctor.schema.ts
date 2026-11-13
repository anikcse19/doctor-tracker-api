import { z } from 'zod';
import { SPECIALIZATIONS } from '../../constants/domain.js';
import {
  emailSchema,
  listQueryShape,
  nameSchema,
  phoneSchema,
  validDateRange,
} from '../../utils/validation.js';

const doctorShape = {
  name: nameSchema,
  specialization: z.enum(SPECIALIZATIONS, { error: 'Select a specialization' }),
  hospital: z
    .string({ error: 'Hospital is required' })
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(2, 'Hospital is required').max(150)),
  phone: phoneSchema,
  email: emailSchema,
};

export const createDoctorSchema = z.object(doctorShape).strict();

export const updateDoctorSchema = z
  .object(doctorShape)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const listDoctorsQuerySchema = z
  .object({
    ...listQueryShape,
    specialization: z.enum(SPECIALIZATIONS).optional(),
    hospital: z.string().trim().max(150).optional(),
  })
  .refine(...validDateRange);

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
