import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  permissions: z.array(z.number()).optional(),
}).passthrough();

export const UpdateRoleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  permissions: z.array(z.number()).optional(),
}).passthrough();
