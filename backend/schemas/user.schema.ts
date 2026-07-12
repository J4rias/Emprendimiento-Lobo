import { z } from 'zod';

export const CreateUserSchema = z.object({
  username: z.string().min(1),
  email: z.string().min(1),
  password: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  role_id: z.number().int().positive(),
  is_active: z.boolean().optional(),
}).passthrough();

export const UpdateUserSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  role_id: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
}).passthrough();
