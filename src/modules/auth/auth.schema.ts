import { z } from 'zod';
import { emailSchema } from '../../utils/validation.js';

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(128),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
