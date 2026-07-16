import { z } from 'zod';

const PreOrderItemSchema = z.object({
  presentation_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive(),
  notes: z.string().nullable().optional(),
}).passthrough();

export const CreatePreOrderSchema = z.object({
  customer_id: z.coerce.number().int().positive().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  currency: z.string().optional(),
  items: z.array(PreOrderItemSchema).min(1),
}).passthrough();

export const ConvertPreOrderSchema = z.object({
  sale_type: z.string().optional(),
  payment_lines: z.array(z.object({
    method: z.string(),
    amount: z.coerce.number(),
    currency: z.string().optional(),
    reference: z.string().nullable().optional(),
  }).passthrough()).optional(),
}).passthrough();
