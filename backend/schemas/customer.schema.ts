import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  type: z.string().min(1),
  document_type: z.string().min(1),
  document_number: z.string().min(1),
  business_name: z.string().min(1),
  trade_name: z.string().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  credit_limit: z.coerce.number(),
  credit_days: z.coerce.number(),
  price_list_id: z.number().int().positive(),
  discount_percentage: z.number().min(0),
  notes: z.string().optional()
}).passthrough();

export const UpdateCustomerSchema = z.object({
  type: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  business_name: z.string().optional(),
  trade_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  credit_limit: z.coerce.number().optional(),
  credit_days: z.coerce.number().optional(),
  price_list_id: z.number().int().positive().optional(),
  discount_percentage: z.number().min(0).optional(),
  notes: z.string().optional()
}).passthrough();
