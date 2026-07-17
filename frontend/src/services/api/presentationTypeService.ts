import api from './axios';

export interface PresentationType {
  id: number;
  name: string;
  is_active: boolean;
}

interface PresentationTypeListResponse {
  data: PresentationType[];
}

export const presentationTypeService = {
  getActive: async (): Promise<PresentationTypeListResponse> => {
    const response = await api.get('/presentation-types/active');
    return response.data;
  },
};
