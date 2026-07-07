import { z } from 'zod';

const PurchaseOrderItemSchema = z.object({
  product_id: z.number().int().positive(),
  presentation_id: z.number().int().positive().nullable().optional(),
  package_quantity: z.number().nullable().optional(),
  loose_units: z.number().nullable().optional(),
  package_cost: z.number().nullable().optional(),
  unit_cost: z.number().nullable().optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  tax_percent: z.number().min(0).optional(),
  notes: z.string().optional(),
}).passthrough();

export const CreatePurchaseOrderSchema = z.object({
  supplier_id: z.number().int().positive(),
  warehouse_id: z.number().int().positive(),
  order_date: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  currency: z.string().optional(),
  settlement_currency: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(PurchaseOrderItemSchema).min(1),
}).passthrough();

export const UpdatePurchaseOrderSchema = z.object({
  supplier_id: z.number().int().positive().optional(),
  warehouse_id: z.number().int().positive().optional(),
  order_date: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  currency: z.string().optional(),
  settlement_currency: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(PurchaseOrderItemSchema).min(1).optional(),
}).passthrough();

export const CancelPurchaseOrderSchema = z.object({
  cancellation_reason: z.string().optional(),
}).passthrough();

const ReceivedItemSchema = z.object({
  purchase_order_detail_id: z.number().int().positive(),
  package_quantity_received: z.number().nullable().optional(),
  loose_units_received: z.number().nullable().optional(),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
}).passthrough();

export const ReceiveMerchandiseSchema = z.object({
  received_items: z.array(ReceivedItemSchema).min(1),
  invoice_number: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();
