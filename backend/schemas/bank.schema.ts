import { z } from 'zod';

export const CreateBankSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  currency: z.enum(['USD', 'COP', 'VES'], {
    message: 'currency debe ser USD, COP o VES',
  }),
  type: z.enum(['bank', 'wallet', 'other']).optional().default('bank'),
}).passthrough();

export const UpdateBankSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  currency: z.enum(['USD', 'COP', 'VES']).optional(),
  type: z.enum(['bank', 'wallet', 'other']).optional(),
  is_active: z.boolean().optional(),
}).passthrough();
