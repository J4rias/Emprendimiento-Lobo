import axios from 'axios';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Brand {
  id: number;
  name: string;
  is_active: boolean;
  product_count?: number;
}

interface BrandListResponse {
  data: Brand[];
  pagination: Pagination;
}

interface BrandResponse {
  message: string;
  data: Brand;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const getAllBrands = async (params?: Record<string, unknown>): Promise<BrandListResponse> => {
  const response = await axios.get(`${API_URL}/brands`, { params });
  return response.data;
};

export const getActiveBrands = async (): Promise<BrandListResponse> => {
  const response = await axios.get(`${API_URL}/brands?is_active=true`);
  return response.data;
};

export const getBrandById = async (id: number): Promise<BrandResponse> => {
  const response = await axios.get(`${API_URL}/brands/${id}`);
  return response.data;
};

export const createBrand = async (data: Omit<Brand, 'id'>): Promise<BrandResponse> => {
  const response = await axios.post(`${API_URL}/brands`, data);
  return response.data;
};

export const updateBrand = async (id: number, data: Partial<Omit<Brand, 'id'>>): Promise<BrandResponse> => {
  const response = await axios.put(`${API_URL}/brands/${id}`, data);
  return response.data;
};

export const deleteBrand = async (id: number): Promise<void> => {
  await axios.delete(`${API_URL}/brands/${id}`);
};