import { z } from 'zod';

export const CreateCompanySchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  tax_id: z.string().optional(),
  website: z.string().optional(),
}).passthrough();

export const UpdateCompanySchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  tax_id: z.string().optional(),
  website: z.string().optional(),
}).passthrough();
