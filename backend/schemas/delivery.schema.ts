import { z } from 'zod';

export const CreateDeliverySchema = z.object({
  // No specific fields identified in the controller snippet for creation,
  // but passthrough is required to allow extra fields.
}).passthrough();

export const UpdateDeliverySchema = z.object({
  // All fields are optional for update.
}).passthrough();

export const ConfirmDeliverySchema = z.object({
  delivery_date: z.string().nullable().optional(),
  signature_image_url: z.string().nullable().optional(),
}).passthrough();

export const CancelDeliverySchema = z.object({
  cancellation_reason: z.string().min(1),
}).passthrough();
