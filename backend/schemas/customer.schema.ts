import { z } from 'zod';

// Frontend sends camelCase; controller destructures snake_case.
// The schema accepts both and validateZod + preprocess normalizes to snake_case.
const customerFields = {
  type: z.string().min(1).optional(),
  // Accept both camelCase (frontend) and snake_case
  documentType: z.string().min(1).optional(),
  document_type: z.string().min(1).optional(),
  documentNumber: z.string().min(1).optional(),
  document_number: z.string().min(1).optional(),
  businessName: z.string().optional(),
  business_name: z.string().optional(),
  tradeName: z.string().nullable().optional(),
  trade_name: z.string().nullable().optional(),
  firstName: z.string().optional(),
  first_name: z.string().optional(),
  lastName: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  creditLimit: z.coerce.number().optional(),
  credit_limit: z.coerce.number().optional(),
  creditDays: z.coerce.number().optional(),
  credit_days: z.coerce.number().optional(),
  priceListId: z.coerce.number().int().positive().nullable().optional(),
  price_list_id: z.coerce.number().int().positive().nullable().optional(),
  discountPercentage: z.coerce.number().min(0).optional(),
  discount_percentage: z.coerce.number().min(0).optional(),
  notes: z.string().nullable().optional(),
};

/** Normalize camelCase → snake_case so the controller always sees snake_case */
export function normalizeCustomerKeys(data: Record<string, any>): Record<string, any> {
  return {
    ...data,
    document_type:       data.document_type ?? data.documentType,
    document_number:     data.document_number ?? data.documentNumber,
    business_name:       data.business_name ?? data.businessName,
    trade_name:          data.trade_name ?? data.tradeName,
    first_name:          data.first_name ?? data.firstName,
    last_name:           data.last_name ?? data.lastName,
    postal_code:         data.postal_code ?? data.postalCode,
    credit_limit:        data.credit_limit ?? data.creditLimit ?? 0,
    credit_days:         data.credit_days ?? data.creditDays ?? 0,
    price_list_id:       data.price_list_id ?? data.priceListId,
    discount_percentage: data.discount_percentage ?? data.discountPercentage ?? 0,
  };
}

export const CreateCustomerSchema = z.object(customerFields).passthrough();

export const UpdateCustomerSchema = z.object(customerFields).partial().passthrough();
