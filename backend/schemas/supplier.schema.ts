import { z } from 'zod';

export const CreateSupplierSchema = z.object({
  name: z.string().min(1),
  tax_id: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  is_active: z.boolean().optional(),
  contacts: z.array(
    z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      is_primary: z.boolean().optional(),
    }).passthrough()
  ).optional()
}).passthrough();

export const UpdateSupplierSchema = z.object({
  name: z.string().optional(),
  tax_id: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  is_active: z.boolean().optional(),
  contacts: z.array(
    z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      is_primary: z.boolean().optional(),
    }).passthrough()
  ).optional()
}).passthrough();
