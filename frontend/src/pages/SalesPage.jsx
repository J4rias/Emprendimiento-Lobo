import { useState, useEffect } from 'react';
import { Eye, Search, Filter, Calendar, DollarSign, TrendingUp, ShoppingBag, XCircle, Trash2, Printer, CreditCard, RefreshCcw } from 'lucide-react';
import { saleService } from '../services/api/saleService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import Modal from '../components/common/Modal';
import { formatDate } from '../utils/formatUtils';
import { printSaleTicket } from '../components/sales/SaleTicket';
import { useCompany } from '../context/CompanyContext';
import SaleReturnModal from '../components/sales/SaleReturnModal';

const SalesPage = () => {
  const { companySettings } = useCompany();
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    sale_type: '',
    start_date: '',
    end_date: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [exchangeRates, setExchangeRates] = useState([]);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSale, setPaymentSale] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount_cop: '',
    method: 'cash',
    reference: '',
    notes: ''
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSale, setReturnSale] = useState(null);

  // COP formatter: convert USD amount to COP using sale's specific rate if available, otherwise current rate
  const copFormat = (usdAmount, saleExchangeRate = null) => {
    const val = parseFloat(usdAmount || 0);
    const rate = saleExchangeRate ? parseFloat(saleExchangeRate) : (calculateEffectiveRate('USD', 'COP', exchangeRates) || 1);
    const cop = Math.round(val * rate);
    return `COP ${cop.toLocaleString('de-DE')}`;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSales();
      loadStats();
      loadExchangeRates();
    }, 300);
    return () => clearTimeout(timer);
  }, [pagination.page, searchTerm, filters.status, filters.sale_type, filters.start_date, filters.end_date]);

  // Optionally reset to page 1 when search or filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, filters.status, filters.sale_type, filters.start_date, filters.end_date]);

  const loadExchangeRates = async () => {
    try {
      const data = await exchangeRateService.getLatest();
      setExchangeRates(data.data || []);
    } catch (e) {
      console.error('Error loading exchange rates:', e);
    }
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        ...filters
      };

      const data = await saleService.getSales(params);
      setSales(data.sales || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }));
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await saleService.getSalesStats(filters);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const getCustomerName = (customer) => {
    if (!customer) return 'Cliente General';
    if (customer.type === 'juridical') {
      return customer.businessName || customer.tradeName || 'Empresa Sin Nombre';
    }
    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Cliente Sin Nombre';
  };

  const handleViewDetail = async (saleId) => {
    try {
      const data = await saleService.getSaleById(saleId);
      setSelectedSale(data.sale);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error loading sale detail:', error);
      alert('Error al cargar el detalle de la venta');
    }
  };

  const handleCancelSale = async (saleId) => {
    const reason = prompt('Ingrese el motivo de la cancelación:');
    if (!reason) return;

    try {
      await saleService.cancelSale(saleId, reason);
      alert('Venta cancelada exitosamente');
      loadSales();
      loadStats();
    } catch (error) {
      console.error('Error cancelling sale:', error);
      alert(error.response?.data?.message || 'Error al cancelar la venta');
    }
  };

  const handleOpenPaymentModal = (sale) => {
    setPaymentSale(sale);
    setPaymentData({
      amount_cop: '',
      method: 'cash',
      reference: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleOpenReturnModal = async (saleId) => {
    try {
      const data = await saleService.getSaleById(saleId);
      setReturnSale(data.sale);
      setShowReturnModal(true);
    } catch (error) {
      console.error('Error loading sale detail for return:', error);
      alert('Error al cargar el detalle de la venta para devolución');
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentData.amount_cop || parseFloat(paymentData.amount_cop) <= 0) {
      alert('Debe ingresar un monto válido mayor a 0');
      return;
    }

    const rate = paymentSale.exchange_rate || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;

    setSubmittingPayment(true);
    try {
      await saleService.addPayment(paymentSale.id, {
        payment_lines: [{
          amount: parseFloat(paymentData.amount_cop),
          method: paymentData.method,
          currency: 'COP',
          exchange_rate: rate,
          reference: paymentData.reference
        }],
        notes: paymentData.notes
      });

      alert('Pago registrado exitosamente');
      setShowPaymentModal(false);
      loadSales();
      loadStats();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert(error.response?.data?.message || 'Error al registrar el pago');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handlePrintTicket = () => {
    if (selectedSale) {
      printSaleTicket(selectedSale, companySettings, {
        displayCurrency: 'COP', // Optional if we want it to default to the ticket's setup
        exchangeRate: selectedSale.exchange_rate || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Completada', className: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
      returned: { label: 'Devuelta', className: 'bg-gray-100 text-gray-800' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getSaleTypeBadge = (type) => {
    return type === 'cash' ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Contado
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        Crédito
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Gestión de Ventas</h1>
        <p className="text-gray-600">Administra y consulta todas las ventas realizadas</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Ventas</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalSales || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ingresos Totales</p>
                <p className="text-2xl font-bold text-gray-800">
                  {copFormat(stats.totalRevenue || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ventas Contado</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.salesByType?.find(s => s.sale_type === 'cash')?.count || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ventas Crédito</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.salesByType?.find(s => s.sale_type === 'credit')?.count || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número de venta o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>

          <select
            value={filters.sale_type}
            onChange={(e) => setFilters({ ...filters, sale_type: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los tipos</option>
            <option value="cash">Contado</option>
            <option value="credit">Crédito</option>
          </select>

          <button
            onClick={() => {
              setFilters({ status: '', sale_type: '', start_date: '', end_date: '' });
              setSearchTerm('');
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total / Pendiente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    Cargando ventas...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No se encontraron ventas
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {sale.sale_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {new Date(sale.sale_date).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 font-medium">
                        {getCustomerName(sale.customer)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSaleTypeBadge(sale.sale_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const saleTotal = parseFloat(sale.total) || (parseFloat(sale.subtotal) - parseFloat(sale.discount_amount));
                        if (sale.sale_type === 'credit') {
                          const pending = saleTotal - parseFloat(sale.paid_amount || 0);
                          if (pending > 0.01) {
                            return (
                              <div>
                                <span className="text-sm font-bold text-red-600">
                                  {copFormat(pending, sale.exchange_rate)}
                                </span>
                                {parseFloat(sale.paid_amount || 0) > 0 && (
                                  <div className="text-[10px] text-gray-400">
                                    de {copFormat(saleTotal, sale.exchange_rate)}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        }
                        return (
                          <span className="text-sm font-bold text-gray-900">
                            {copFormat(saleTotal, sale.exchange_rate)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(sale.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetail(sale.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Ver detalle"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {sale.sale_type === 'credit' && sale.status === 'pending' && (
                          <button
                            onClick={() => handleOpenPaymentModal(sale)}
                            className="text-emerald-600 hover:text-emerald-800"
                            title="Abonar Pago"
                          >
                            <CreditCard className="w-5 h-5" />
                          </button>
                        )}
                        {sale.status === 'completed' && (
                          <button
                            onClick={() => handleOpenReturnModal(sale.id)}
                            className="text-rose-600 hover:text-rose-800"
                            title="Generar Devolución"
                          >
                            <RefreshCcw className="w-5 h-5" />
                          </button>
                        )}
                        {sale.status !== 'cancelled' && sale.status !== 'returned' && (
                          <button
                            onClick={() => handleCancelSale(sale.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Cancelar venta"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} ventas
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={
          <div className="flex items-center gap-4">
            <span>Detalle de Venta - {selectedSale?.sale_number}</span>
            {selectedSale && (
              <button
                onClick={handlePrintTicket}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-xs font-bold border border-blue-100"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Comprobante
              </button>
            )}
          </div>
        }
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-6">
            {/* Sale Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Fecha</p>
                <p className="text-sm font-medium text-gray-800">
                  {formatDate(selectedSale.sale_date)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Cliente</p>
                <p className="text-sm font-medium text-gray-800">
                  {getCustomerName(selectedSale.customer)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Vendedor</p>
                <p className="text-sm font-medium text-gray-800">
                  {selectedSale.seller?.first_name || selectedSale.seller?.username || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Almacén</p>
                <p className="text-sm font-medium text-gray-800">{selectedSale.warehouse?.name}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-2 px-1">Resumen de Productos</h3>
              <div className="border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Descripción</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase">Cant.</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">P. Unit</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedSale.details?.map((detail) => (
                      <tr key={detail.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{detail.product?.name}</div>
                          <div className="text-[11px] text-gray-500">{detail.presentation?.name}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600 font-medium">
                          {parseFloat(detail.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 font-medium">
                          {copFormat(detail.unit_price, selectedSale.exchange_rate)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {copFormat(detail.total, selectedSale.exchange_rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals & Payments */}
            <div className="flex flex-col md:flex-row gap-6 border-t border-gray-100 pt-6">
              {/* Payment History */}
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-800 mb-2">Historial de Pagos</h3>
                {selectedSale.payments?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSale.payments.map((p, idx) => {
                      let amountCOP = parseFloat(p.amount || 0);
                      if (p.currency !== 'COP') {
                        const amountUSD = parseFloat(p.amount || 0) / parseFloat(p.exchange_rate || 1);
                        amountCOP = amountUSD * parseFloat(selectedSale.exchange_rate || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1);
                      }

                      return (
                        <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded">
                          <span className="text-gray-500">{formatDate(p.payment_date)}</span>
                          <span className="font-semibold text-slate-700 capitalize">{p.payment_method === 'cash' ? 'Efectivo' : p.payment_method}</span>
                          <span className="font-bold text-emerald-600">COP {Math.round(amountCOP).toLocaleString('de-DE')}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No hay pagos registrados</p>
                )}
              </div>

              {/* Final Totals */}
              <div className="w-full md:w-64 space-y-2">
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-900">Total</span>
                  <span className="text-blue-600">{copFormat(parseFloat(selectedSale.subtotal) - parseFloat(selectedSale.discount_amount), selectedSale.exchange_rate)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-gray-500 italic">Monto Pagado</span>
                  <span className="font-semibold text-emerald-600">{copFormat(selectedSale.paid_amount || 0, selectedSale.exchange_rate)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedSale.notes && (
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                <p className="text-[11px] font-bold text-amber-800 uppercase mb-1">Notas / Observaciones</p>
                <p className="text-xs text-amber-900 whitespace-pre-wrap">{selectedSale.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => !submittingPayment && setShowPaymentModal(false)}
        title={
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <span>Registrar Abono a Venta {paymentSale?.sale_number}</span>
          </div>
        }
        size="md"
      >
        {paymentSale && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center">
              <div>
                <p className="text-xs text-emerald-800 font-semibold">Saldo Pendiente (Aprox)</p>
                <p className="text-lg font-bold text-emerald-900">
                  {copFormat((parseFloat(paymentSale.total) - parseFloat(paymentSale.paid_amount || 0)), paymentSale.exchange_rate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-800 font-semibold">Cliente</p>
                <p className="text-sm font-medium text-emerald-900 truncate max-w-[150px]">
                  {paymentSale.customer?.name || 'Cliente'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto a Abonar (COP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                  $
                </span>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={paymentData.amount_cop}
                  onChange={(e) => setPaymentData({ ...paymentData, amount_cop: e.target.value })}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-lg"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  required
                  value={paymentData.method}
                  onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta / Punto</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia
                </label>
                <input
                  type="text"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Ej. #12345"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas adicionales
              </label>
              <textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                rows="2"
                placeholder="Observaciones sobre el pago..."
              ></textarea>
            </div>

            <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={submittingPayment}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingPayment}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {submittingPayment ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Registrar Abono
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Return Modal */}
      <SaleReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        sale={returnSale}
        onReturnSuccess={() => {
          setShowReturnModal(false);
          loadSales();
          loadStats();
        }}
      />
    </div>
  );
};

export default SalesPage;
