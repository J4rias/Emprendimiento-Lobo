import { z } from 'zod';

export const CreateInventorySchema = z.object({
  product_id: z.coerce.number().int().positive(),
  warehouse_id: z.coerce.number().int().positive(),
  type: z.enum(['add', 'remove']),
  presentation_id: z.coerce.number().int().positive().nullable().optional(),
  package_quantity: z.coerce.number().nullable().optional(),
  loose_units: z.coerce.number().nullable().optional(),
  document_number: z.string().nullable().optional(),
  batch_id: z.coerce.number().int().positive().nullable().optional(),
  reason: z.string().nullable().optional(),
}).passthrough();

export const UpdateInventorySchema = z.object({
  product_id: z.coerce.number().int().positive().optional(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  type: z.enum(['add', 'remove']).optional(),
  presentation_id: z.coerce.number().int().positive().nullable().optional(),
  package_quantity: z.coerce.number().nullable().optional(),
  loose_units: z.coerce.number().nullable().optional(),
  document_number: z.string().nullable().optional(),
  batch_id: z.coerce.number().int().positive().nullable().optional(),
  reason: z.string().nullable().optional(),
}).passthrough();
