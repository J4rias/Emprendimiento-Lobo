import { z } from 'zod';

const PreOrderItemSchema = z.object({
  presentation_id: z.number().int().positive(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
}).passthrough();

export const CreatePreOrderSchema = z.object({
  customer_id: z.number().int().positive().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  channel: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().optional(),
  items: z.array(PreOrderItemSchema).min(1),
}).passthrough();

export const ConvertPreOrderSchema = z.object({
  sale_type: z.string().optional(),
  payment_lines: z.array(z.object({
    method: z.string(),
    amount: z.number(),
    currency: z.string().optional(),
    reference: z.string().optional(),
  }).passthrough()).optional(),
}).passthrough();
