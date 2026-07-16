import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  type: z.string().min(1),
  document_type: z.string().min(1),
  document_number: z.string().min(1),
  business_name: z.string().min(1),
  trade_name: z.string().nullable().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  credit_limit: z.coerce.number(),
  credit_days: z.coerce.number(),
  price_list_id: z.number().int().positive().nullable().optional(),
  discount_percentage: z.number().min(0),
  notes: z.string().nullable().optional()
}).passthrough();

export const UpdateCustomerSchema = z.object({
  type: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  business_name: z.string().optional(),
  trade_name: z.string().nullable().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  credit_limit: z.coerce.number().optional(),
  credit_days: z.coerce.number().optional(),
  price_list_id: z.number().int().positive().nullable().optional(),
  discount_percentage: z.number().min(0).optional(),
  notes: z.string().nullable().optional()
}).passthrough();
