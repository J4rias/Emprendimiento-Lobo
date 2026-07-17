import { z } from 'zod';

export const CreateUserSchema = z.object({
  username: z.string().trim().min(1),
  email: z.string().trim().min(1),
  password: z.string().min(1),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  role_id: z.coerce.number().int().positive(),
  is_active: z.boolean().optional(),
}).passthrough();

export const UpdateUserSchema = z.object({
  email: z.string().trim().optional(),
  password: z.string().optional(),
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  role_id: z.coerce.number().int().positive().optional(),
  is_active: z.boolean().optional(),
}).passthrough();
