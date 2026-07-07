import { z } from 'zod';

export const CreateExchangeRateSchema = z.object({
  from_currency: z.enum(['USD', 'COP', 'VES']),
  to_currency: z.enum(['USD', 'COP', 'VES']),
  rate: z.coerce.number().min(0),
  effective_date: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export const UpdateExchangeRateSchema = z.object({
  from_currency: z.enum(['USD', 'COP', 'VES']).optional(),
  to_currency: z.enum(['USD', 'COP', 'VES']).optional(),
  rate: z.coerce.number().min(0).optional(),
  effective_date: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();
