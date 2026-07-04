import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const CompanyContext = createContext(null);

export const CompanyProvider = ({ children }) => {
  const { token } = useAuth();
  const [companySettings, setCompanySettings] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    tax_id: '',
    website: '',
  });

  const fetchCompany = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}/company`, { headers });
      const data = await response.json();
      if (data.data) {
        setCompanySettings(data.data);
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
