import { z } from 'zod';

export const CreateSupplierSchema = z.object({
  name: z.string().trim().min(1),
  tax_id: z.string().trim().min(1),
  payment_terms: z.string().trim().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  contacts: z.array(
    z.object({
      name: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      email: z.string().trim().optional(),
      is_primary: z.boolean().optional(),
    }).passthrough()
  ).optional()
}).passthrough();

export const UpdateSupplierSchema = z.object({
  name: z.string().trim().optional(),
  tax_id: z.string().trim().optional(),
  payment_terms: z.string().trim().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  contacts: z.array(
    z.object({
      name: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      email: z.string().trim().optional(),
      is_primary: z.boolean().optional(),
    }).passthrough()
  ).optional()
}).passthrough();
