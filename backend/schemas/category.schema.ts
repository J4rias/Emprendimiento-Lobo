import { z } from 'zod';

export const CreateCategorySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
}).passthrough();

export const UpdateCategorySchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
}).passthrough();
