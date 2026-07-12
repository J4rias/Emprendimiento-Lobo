import { z } from 'zod';

export const CreateTransferSchema = z.object({
  origin_warehouse_id: z.number().int().positive(),
  destination_warehouse_id: z.number().int().positive(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    presentation_id: z.number().int().positive().nullable().optional(),
    package_quantity: z.number().int().nullable().optional(),
    loose_units: z.number().int().nullable().optional(),
    batch_id: z.number().int().nullable().optional(),
  }).passthrough()).min(1),
}).passthrough();

export const CancelTransferSchema = z.object({
  reason: z.string().optional(),
}).passthrough();
