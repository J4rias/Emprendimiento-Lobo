import { z } from 'zod';

const QuoteDetailSchema = z.object({
  product_id: z.number().int().positive(),
  product_presentation_id: z.number().int().positive(),
  description: z.string().nullable().optional(),
  quantity: z.coerce.number(),
  unit_price: z.coerce.number().min(0),
  discount_percentage: z.coerce.number().nullable().optional(),
  discount_amount: z.coerce.number().nullable().optional(),
  tax_percentage: z.coerce.number().nullable().optional(),
  subtotal: z.coerce.number().nullable().optional(),
  total: z.coerce.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  line_order: z.coerce.number().nullable().optional()
}).passthrough();

export const CreateQuoteSchema = z.object({
  customer_id: z.number().int().positive(),
  price_list_id: z.number().int().positive().nullable().optional(),
  currency: z.string().optional(),
  details: z.array(QuoteDetailSchema),
  notes: z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  delivery_terms: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional()
}).passthrough();

export const UpdateQuoteSchema = z.object({
  customer_id: z.number().int().positive().optional(),
  price_list_id: z.number().int().positive().nullable().optional(),
  currency: z.string().optional(),
  details: z.array(QuoteDetailSchema).optional(),
  notes: z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  delivery_terms: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional()
}).passthrough();
