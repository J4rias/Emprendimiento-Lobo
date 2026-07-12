import { z } from 'zod';

export const CreateReservationSchema = z.object({
  session_id: z.number().int().positive(),
  tab_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  presentation_id: z.number().int().positive(),
  units_requested: z.number().min(0),
}).passthrough();

export const UpdateReservationSchema = z.object({
  units_to_release: z.number().min(0).optional(),
}).passthrough();

export const CleanupExpiredSchema = z.object({}).passthrough();
