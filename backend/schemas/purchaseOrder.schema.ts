import { z } from 'zod';

const PurchaseOrderItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  presentation_id: z.coerce.number().int().positive().nullable().optional(),
  package_quantity: z.coerce.number().nullable().optional(),
  loose_units: z.coerce.number().nullable().optional(),
  package_cost: z.coerce.number().nullable().optional(),
  unit_cost: z.coerce.number().nullable().optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  tax_percent: z.coerce.number().min(0).optional(),
  notes: z.string().nullable().optional(),
}).passthrough();

export const CreatePurchaseOrderSchema = z.object({
  supplier_id: z.coerce.number().int().positive(),
  warehouse_id: z.coerce.number().int().positive(),
  order_date: z.string().nullable().optional(),
  expected_delivery_date: z.string().nullable().optional(),
  currency: z.string().optional(),
  settlement_currency: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(PurchaseOrderItemSchema).min(1),
}).passthrough();

export const UpdatePurchaseOrderSchema = z.object({
  supplier_id: z.coerce.number().int().positive().optional(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  order_date: z.string().nullable().optional(),
  expected_delivery_date: z.string().nullable().optional(),
  currency: z.string().optional(),
  settlement_currency: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(PurchaseOrderItemSchema).min(1).optional(),
}).passthrough();

export const CancelPurchaseOrderSchema = z.object({
  cancellation_reason: z.string().nullable().optional(),
}).passthrough();

const ReceivedItemSchema = z.object({
  detail_id: z.coerce.number().int().positive(),
  package_quantity: z.coerce.number().min(0).nullable().optional(),
  loose_units: z.coerce.number().min(0).nullable().optional(),
  batch_number: z.string().nullable().optional(),
  manufacture_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
}).passthrough();

export const ReceiveMerchandiseSchema = z.object({
  received_items: z.array(ReceivedItemSchema).min(1),
  invoice_number: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).passthrough();
