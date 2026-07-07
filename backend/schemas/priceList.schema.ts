import { z } from 'zod';

export const CreatePriceListSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  currency: z.string().min(1),
  is_default: z.boolean().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  validity_days: z.coerce.number().optional(),
}).passthrough();

export const UpdatePriceListSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  currency: z.string().optional(),
  is_default: z.boolean().optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  validity_days: z.coerce.number().optional(),
}).passthrough();

export const UpdateDetailSchema = z.object({
  presentation_id: z.coerce.number(),
  product_id: z.coerce.number(),
  client_updated_at: z.string().optional(),
  package_cost: z.coerce.number(),
  unit_cost: z.coerce.number(),
  package_price: z.coerce.number(),
  unit_price: z.coerce.number(),
  margin_percentage: z.coerce.number(),
  is_frozen: z.boolean().optional(),
  frozen_price: z.coerce.number().optional(),
  frozen_currency: z.string().optional(),
  package_price_usd: z.coerce.number().optional(),
}).passthrough();

export const DuplicatePriceListSchema = z.object({}).passthrough();
