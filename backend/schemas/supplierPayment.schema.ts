import { z } from 'zod';

export const CreateSupplierPaymentSchema = z.object({
  supplier_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().min(0),
  payment_date: z.string().min(1),
  payment_method: z.string().min(1),
  currency: z.string().min(1),
  reference: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  bank_id: z.coerce.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  exchange_rate: z.coerce.number().nullable().optional(),
  exchange_rate_from: z.string().nullable().optional(),
  exchange_rate_to: z.string().nullable().optional(),
  allocations: z.array(z.object({
    purchase_order_id: z.coerce.number().int().positive(),
    invoice_number: z.string().nullable().optional(),
    allocated_amount: z.coerce.number().min(0),
  }).passthrough()).nullable().optional(),
}).passthrough();

export const UpdateSupplierPaymentSchema = z.object({
  payment_date: z.string().nullable().optional(),
  payment_method: z.string().min(1).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  reference: z.string().nullable().optional(),
  bank_id: z.coerce.number().int().positive().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).passthrough();

export const CancelPaymentSchema = z.object({
  reason: z.string().nullable().optional(),
}).passthrough();
