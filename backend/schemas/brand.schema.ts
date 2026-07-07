import { z } from 'zod';

export const CreateBrandSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
}).passthrough();

export const UpdateBrandSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
}).passthrough();
