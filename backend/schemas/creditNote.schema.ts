import { z } from 'zod';

export const CreateCreditNoteSchema = z.object({
  sale_id: z.number().int().positive(),
  reason: z.string().min(1),
  reason_description: z.string().optional(),
  type: z.string().min(1),
  refund_method: z.string().optional(),
  refund_amount: z.number().optional(),
  refund_reference: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    sale_detail_id: z.number().int().positive(),
    package_quantity_returned: z.number().optional(),
    loose_units_returned: z.number().optional(),
    return_to_stock: z.boolean().optional(),
  }).passthrough()).min(1),
}).passthrough();

export const CancelCreditNoteSchema = z.object({
  cancellation_reason: z.string().optional(),
}).passthrough();
