import api from './axios';

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
  website: string;
  [key: string]: unknown;
}

export const companyService = {
  get: () => api.get<{ data: CompanySettings }>('/company'),
};
