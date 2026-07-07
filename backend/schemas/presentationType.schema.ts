import { z } from 'zod';

export const CreatePresentationTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
}).passthrough();

export const UpdatePresentationTypeSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
}).passthrough();
