import { z } from 'zod';

export const CreateReservationSchema = z.object({
  session_id: z.union([z.string().min(1), z.number()]),
  tab_id: z.union([z.string().min(1), z.number()]),
  product_id: z.number().int().positive(),
  presentation_id: z.number().int().positive(),
  units_requested: z.number().min(0),
}).passthrough();

export const UpdateReservationSchema = z.object({
  session_id: z.union([z.string().min(1), z.number()]),
  tab_id: z.union([z.string().min(1), z.number()]),
  presentation_id: z.number().int().positive(),
  units_to_release: z.number().min(0).optional(),
}).passthrough();

export const CleanupExpiredSchema = z.object({}).passthrough();
