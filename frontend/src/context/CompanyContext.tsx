import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { companyService, type CompanySettings } from '../services/api/companyService';

interface CompanyContextValue {
  companyName: string;
  companySettings: CompanySettings;
  reloadCompany: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: '',
    address: '',
    phone: '',
    email: '',
    tax_id: '',
    website: '',
  });

  const fetchCompany = useCallback(async () => {
    try {
      const response = await companyService.get();
      if (response.data.data) {
        setCompanySettings(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar configuración de empresa:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  return (
    <CompanyContext.Provider
      value={{
        companyName: companySettings.name || 'Mi Empresa',
        companySettings,
        reloadCompany: fetchCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany debe usarse dentro de CompanyProvider');
  return ctx;
};
