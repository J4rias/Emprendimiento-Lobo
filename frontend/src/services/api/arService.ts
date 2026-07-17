import api from './axios';

export const arService = {
  getSummary: (params: Record<string, unknown> = {}) =>
    api.get('/accounts-receivable/summary', { params }).then(r => r.data),

  getCustomers: (params: Record<string, unknown> = {}) =>
    api.get('/accounts-receivable/customers', { params }).then(r => r.data),

  getCustomerStatement: (customerId: number) =>
    api.get(`/accounts-receivable/customers/${customerId}/statement`).then(r => r.data),

  reversePayment: (paymentId: number, pin: string) =>
    api.post(`/accounts-receivable/payments/${paymentId}/reverse`, { pin }).then(r => r.data),

  getAdminPinStatus: () => api.get('/accounts-receivable/admin-pin/status').then(r => r.data),
  validateAdminPin: (pin: string) => api.post('/accounts-receivable/admin-pin/validate', { pin }).then(r => r.data),
  setAdminPin: (pin: string) => api.put('/accounts-receivable/admin-pin', { pin }).then(r => r.data),

  exportInvoicesCSV: async (params: Record<string, string> = {}) => {
    try {
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      const qs = new URLSearchParams(filteredParams).toString();
      const response = await api.get(`/accounts-receivable/export/invoices${qs ? '?' + qs : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data as Blob);
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

  exportCustomersCSV: async (params: Record<string, string> = {}) => {
    try {
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      const qs = new URLSearchParams(filteredParams).toString();
      const response = await api.get(`/accounts-receivable/export/customers${qs ? '?' + qs : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data as Blob);
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
