import { z } from 'zod';

export const CreatePriceListSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  currency: z.string().min(1),
  is_default: z.boolean().optional(),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  validity_days: z.coerce.number().nullable().optional(),
}).passthrough();

export const UpdatePriceListSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  currency: z.string().optional(),
  is_default: z.boolean().optional(),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  validity_days: z.coerce.number().nullable().optional(),
}).passthrough();

export const UpdateDetailSchema = z.object({
  presentation_id: z.coerce.number(),
  product_id: z.coerce.number(),
  client_updated_at: z.string().nullable().optional(),
  package_cost: z.coerce.number(),
  unit_cost: z.coerce.number(),
  package_price: z.coerce.number(),
  unit_price: z.coerce.number(),
  margin_percentage: z.coerce.number(),
  is_frozen: z.boolean().optional(),
  frozen_price: z.coerce.number().nullable().optional(),
  frozen_currency: z.string().nullable().optional(),
  package_price_usd: z.coerce.number().nullable().optional(),
}).passthrough();

export const DuplicatePriceListSchema = z.object({}).passthrough();
