import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  is_active: z.boolean().optional(),
  permissions: z.array(z.number()).optional(),
}).passthrough();

export const UpdateRoleSchema = z.object({
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
  is_active: z.boolean().optional(),
  permissions: z.array(z.number()).optional(),
}).passthrough();
