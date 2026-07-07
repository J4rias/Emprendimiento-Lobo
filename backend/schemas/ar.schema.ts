import { z } from 'zod';

export const ReversePaymentSchema = z.object({
  pin: z.string().min(1),
}).passthrough();

export const ValidateAdminPinSchema = z.object({
  pin: z.string().min(1),
}).passthrough();

export const UpdateArSchema = z.object({
  pin: z.string().optional(),
}).passthrough();
