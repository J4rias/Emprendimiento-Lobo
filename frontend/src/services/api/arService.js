import api from './axios';

export const arService = {
  // Resumen general (facturas + aging distribution)
  getSummary: (params = {}) => api.get('/ar/summary', { params }).then(r => r.data),

  // Clientes con saldo pendiente
  getCustomers: (params = {}) => api.get('/ar/customers', { params }).then(r => r.data),

  // Statement completo de un cliente (en COP)
  getCustomerStatement: (customerId) => api.get(`/ar/customers/${customerId}/statement`).then(r => r.data),

  // Revertir un abono (requiere PIN)
  reversePayment: (paymentId, pin) =>
    api.post(`/ar/payments/${paymentId}/reverse`, { pin }).then(r => r.data),

  // PIN de crédito
  getAdminPinStatus: () => api.get('/ar/admin-pin/status').then(r => r.data),
  validateAdminPin: (pin) => api.post('/ar/admin-pin/validate', { pin }).then(r => r.data),
  setAdminPin: (pin) => api.put('/ar/admin-pin', { pin }).then(r => r.data),

  // Exportar CSV
  exportInvoicesCSV: async (params = {}) => {
    try {
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      const qs = new URLSearchParams(filteredParams).toString();
      const response = await api.get(`/ar/export/invoices${qs ? '?' + qs : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cuentas-por-cobrar-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exportando CSV:', error);
    }
  },
  exportCustomersCSV: async (params = {}) => {
    try {
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      const qs = new URLSearchParams(filteredParams).toString();
      const response = await api.get(`/ar/export/customers${qs ? '?' + qs : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clientes-cartera-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exportando CSV:', error);
    }
  }
};
