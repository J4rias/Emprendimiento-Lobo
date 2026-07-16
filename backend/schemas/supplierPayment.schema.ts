import { z } from 'zod';

export const CreateSupplierPaymentSchema = z.object({
  supplier_id: z.number().int().positive(),
  payment_number: z.string().min(1),
  reference: z.string().min(1),
  amount: z.number().min(0),
  payment_date: z.string().nullable().optional(),
  payment_method: z.string().min(1),
  currency: z.string().min(1),
  notes: z.string().nullable().optional(),
}).passthrough();

export const UpdateSupplierPaymentSchema = z.object({
  supplier_id: z.number().int().positive().optional(),
  payment_number: z.string().min(1).optional(),
  reference: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  payment_date: z.string().nullable().optional(),
  payment_method: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
}).passthrough();

export const CancelPaymentSchema = z.object({
  reason: z.string().nullable().optional(),
}).passthrough();
