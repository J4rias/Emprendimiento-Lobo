import { z } from 'zod';

export const CreateCreditNoteSchema = z.object({
  sale_id: z.coerce.number().int().positive(),
  reason: z.string().min(1),
  reason_description: z.string().nullable().optional(),
  type: z.string().min(1),
  refund_method: z.string().nullable().optional(),
  refund_amount: z.coerce.number().nullable().optional(),
  refund_reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(z.object({
    sale_detail_id: z.coerce.number().int().positive(),
    package_quantity_returned: z.coerce.number().optional(),
    loose_units_returned: z.coerce.number().optional(),
    return_to_stock: z.boolean().optional(),
  }).passthrough()).min(1),
}).passthrough();

export const CancelCreditNoteSchema = z.object({
  cancellation_reason: z.string().nullable().optional(),
}).passthrough();
