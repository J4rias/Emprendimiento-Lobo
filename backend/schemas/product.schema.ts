import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(1),
  category_id: z.number().int().positive(),
  brand_id: z.number().int().positive().optional(),
  min_stock: z.coerce.number().optional(),
  max_stock: z.coerce.number().optional(),
  reorder_point: z.coerce.number().optional(),
}).passthrough();

export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category_id: z.number().int().positive().optional(),
  brand_id: z.number().int().positive().optional(),
  min_stock: z.coerce.number().optional(),
  max_stock: z.coerce.number().optional(),
  reorder_point: z.coerce.number().optional(),
}).passthrough();

export const CreatePresentationSchema = z.object({
  name: z.string().min(1),
  units_per_package: z.coerce.number().min(1),
  packaging_type_id: z.number().int().positive().optional(),
  presentation_type_id: z.number().int().positive().optional(),
  package_price: z.number().min(0).optional(),
  package_cost: z.number().min(0).optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
}).passthrough();

export const UpdatePresentationSchema = z.object({
  name: z.string().min(1).optional(),
  units_per_package: z.coerce.number().min(1).optional(),
  packaging_type_id: z.number().int().positive().optional(),
  presentation_type_id: z.number().int().positive().optional(),
  package_price: z.number().min(0).optional(),
  package_cost: z.number().min(0).optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
}).passthrough();
