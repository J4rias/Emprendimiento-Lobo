import { z } from 'zod';

const QuoteDetailSchema = z.object({
  product_id: z.number().int().positive(),
  product_presentation_id: z.number().int().positive(),
  description: z.string().optional(),
  quantity: z.coerce.number(),
  unit_price: z.coerce.number().min(0),
  discount_percentage: z.coerce.number().optional(),
  discount_amount: z.coerce.number().optional(),
  tax_percentage: z.coerce.number().optional(),
  subtotal: z.coerce.number().optional(),
  total: z.coerce.number().optional(),
  notes: z.string().optional(),
  line_order: z.coerce.number().optional()
}).passthrough();

export const CreateQuoteSchema = z.object({
  customer_id: z.number().int().positive(),
  price_list_id: z.number().int().positive().optional(),
  currency: z.string().optional(),
  details: z.array(QuoteDetailSchema),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  payment_terms: z.string().optional(),
  delivery_terms: z.string().optional(),
  valid_until: z.string().optional()
}).passthrough();

export const UpdateQuoteSchema = z.object({
  customer_id: z.number().int().positive().optional(),
  price_list_id: z.number().int().positive().optional(),
  currency: z.string().optional(),
  details: z.array(QuoteDetailSchema).optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  payment_terms: z.string().optional(),
  delivery_terms: z.string().optional(),
  valid_until: z.string().optional()
}).passthrough();
