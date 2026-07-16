import { z } from 'zod';

export const CreateTransferSchema = z.object({
  origin_warehouse_id: z.coerce.number().int().positive(),
  destination_warehouse_id: z.coerce.number().int().positive(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.coerce.number().int().positive(),
    presentation_id: z.coerce.number().int().positive().nullable().optional(),
    package_quantity: z.coerce.number().int().nullable().optional(),
    loose_units: z.coerce.number().int().nullable().optional(),
    batch_id: z.coerce.number().int().nullable().optional(),
  }).passthrough()).min(1),
}).passthrough();

export const CancelTransferSchema = z.object({
  reason: z.string().optional(),
}).passthrough();
