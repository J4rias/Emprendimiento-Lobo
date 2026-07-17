import api from './axios';

export interface PackagingType {
  id: number;
  name: string;
  is_active: boolean;
}

interface PackagingTypeListResponse {
  data: PackagingType[];
}

export const packagingTypeService = {
  getActive: async (): Promise<PackagingTypeListResponse> => {
    const response = await api.get('/packaging-types/active');
    return response.data;
  },
};
