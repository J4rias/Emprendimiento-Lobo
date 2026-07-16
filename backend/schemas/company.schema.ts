import { z } from 'zod';

export const CreateCompanySchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
}).passthrough();

export const UpdateCompanySchema = z.object({
  name: z.string().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
}).passthrough();
