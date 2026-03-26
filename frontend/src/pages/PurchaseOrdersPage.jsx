import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '../utils/formatUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { supplierService } from '../services/api/supplierService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Check,
  X,
  Package,
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';

const PurchaseOrdersPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingOrderId, setApprovingOrderId] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [viewingOrder, setViewingOrder] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('this_week');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: ordersData, isLoading: loading, error: fetchError } = useQuery({
    queryKey: ['purchase-orders', currentPage, debouncedSearch, statusFilter, supplierFilter],
    queryFn: () => purchaseOrderService.getAll({
      page: currentPage, limit: 20,
      search: debouncedSearch,
      status: statusFilter || undefined,
      supplier_id: supplierFilter || undefined,
    }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['purchase-orders-stats', statsPeriod],
    queryFn: () => purchaseOrderService.getStats(getDateRangeForPeriod(statsPeriod)),
    staleTime: 30_000,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => supplierService.getActive(),
    staleTime: 5 * 60_000,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => exchangeRateService.getLatest(),
    staleTime: 5 * 60_000,
  });

  const orders = ordersData?.data || [];
  const totalPages = ordersData?.pagination?.totalPages || 1;
  const stats = statsData?.data || null;
  const suppliers = suppliersData?.data || [];
  const exchangeRates = ratesData?.data || [];
  const error = fetchError?.message || mutationError;

  const copFormat = (amount, currency) => {
    const val = parseFloat(amount || 0);
    if (currency === 'COP') return `COP ${val.toLocaleString('de-DE')}`;
    const rate = calculateEffectiveRate(currency, 'COP', exchangeRates) || 1;
    const cop = Math.round(val * rate);
    return `COP ${cop.toLocaleString('de-DE')}`;
  };

  const calculateTotalValueInCOP = () => {
    if (!stats?.value_by_currency) return 0;
    let total = 0;
    stats.value_by_currency.forEach(item => {
      if (item.currency === 'COP') {
        total += parseFloat(item.total || 0);
      } else {
        const rate = calculateEffectiveRate(item.currency, 'COP', exchangeRates) || 1;
        total += parseFloat(item.total || 0) * rate;
      }
    });
    return total;
  };

  const getDateRangeForPeriod = (period) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    let date_from, date_to;

    switch (period) {
      case 'this_week':
        const currentDay = start.getDay();
        const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
        start.setDate(start.getDate() - distanceToMonday);
        date_from = start.toISOString();
        date_to = today.toISOString();
        break;
      case 'this_month':
        start.setDate(1);
        date_from = start.toISOString();
        date_to = today.toISOString();
        break;
      case 'last_month':
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        date_from = start.toISOString();
        date_to = endOfLastMonth.toISOString();
        break;
      case 'last_30_days':
        start.setDate(start.getDate() - 30);
        date_from = start.toISOString();
        date_to = today.toISOString();
        break;
      case 'this_year':
        start.setMonth(0, 1);
        date_from = start.toISOString();
        date_to = today.toISOString();
        break;
      case 'all':
      default:
        return {};
    }
    return { date_from, date_to };
  };


  const handleView = async (order) => {
    try {
      const response = await purchaseOrderService.getById(order.id);
      setViewingOrder(response.data);
      setShowViewModal(true);
    } catch (err) {
      setMutationError('Error al cargar el detalle de la orden');
      console.error('Error fetching order details:', err);
    }
  };

  const handleEdit = (order) => {
    navigate(`/purchase-orders/edit/${order.id}`);
  };

  const handleApproveClick = (id) => {
    setApprovingOrderId(id);
    setShowApproveModal(true);
  };

  const handleApproveConfirm = async () => {
    try {
      await purchaseOrderService.approve(approvingOrderId);
      setShowApproveModal(false);
      setApprovingOrderId(null);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-stats'] });
    } catch (err) {
      setMutationError('Error al aprobar la orden');
      console.error('Error approving order:', err);
    }
  };

  const handleCancelClick = (id) => {
    setCancellingOrderId(id);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) {
      alert('Por favor, ingrese un motivo para la cancelación.');
      return;
    }

    try {
      await purchaseOrderService.cancel(cancellingOrderId, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      setCancellingOrderId(null);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders-stats'] });
    } catch (err) {
      setMutationError('Error al cancelar la orden');
      console.error('Error canceling order:', err);
    }
  };

  const handleReceive = (order) => {
    navigate(`/purchase-orders/receive/${order.id}`);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
      sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700', icon: Clock },
      confirmed: { label: 'Confirmada', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
      partially_received: { label: 'Parcialmente Recibida', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
      received: { label: 'Recibida', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700', icon: XCircle }
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getPaymentBadge = (paymentStatus) => {
    const pStatusConfig = {
      paid: { label: 'Pagada', color: 'bg-emerald-100 text-emerald-700', icon: DollarSign },
      partial: { label: 'Abonada', color: 'bg-blue-100 text-blue-700', icon: DollarSign },
      pending: { label: 'Pendiente Pago', color: 'bg-gray-100 text-gray-600', icon: Clock }
    };

    // Only show if we actually have a payment status definition
    if (!paymentStatus || !pStatusConfig[paymentStatus]) return null;

    const pConfig = pStatusConfig[paymentStatus];
    const UserIcon = pConfig.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${pConfig.color} mt-1`}>
        <UserIcon className="w-3 h-3" />
        {pConfig.label}
      </span>
    );
  };

  const columns = [
    {
      header: 'Número',
      accessor: (row) => (
        <div className="font-medium text-gray-900">{row.order_number}</div>
      )
    },
    {
      header: 'Proveedor',
      accessor: (row) => (
        <div>
          <div className="font-medium text-gray-900">{row.supplier?.name}</div>
          <div className="text-sm text-gray-500">{row.supplier?.code}</div>
        </div>
      )
    },
    {
      header: 'Fecha',
      accessor: (row) => (
        <div className="text-sm text-gray-600">
          {new Date(row.order_date).toLocaleDateString('es-PE')}
        </div>
      )
    },
    {
      header: 'Almacén',
      accessor: (row) => (
        <div className="text-sm text-gray-600">{row.warehouse?.name}</div>
      )
    },
    {
      header: 'Total',
      accessor: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">
            {formatMoney(row.total, row.currency)}
          </span>
          {row.currency !== 'COP' && (
            <span className="text-xs text-emerald-600 font-medium mt-0.5">
              ≈ {copFormat(row.total, row.currency)}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Estado',
      accessor: (row) => (
        <div className="flex flex-col items-start gap-1">
          {getStatusBadge(row.status)}
          {['received', 'partially_received', 'confirmed'].includes(row.status) && getPaymentBadge(row.payment_status)}
        </div>
      )
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleView(row)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Ver detalles"
          >
            <Eye className="h-4 w-4" />
          </button>

          {['partially_received', 'received'].includes(row.status) && hasPermission('supplier_payments.create') && (
            <button
              onClick={() => navigate('/supplier-payments', { state: { prefillOrder: row } })}
              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
              title="Registrar Pago"
            >
              <CreditCard className="h-4 w-4" />
            </button>
          )}

          {row.status === 'draft' && hasPermission('purchases.update') && (
            <button
              onClick={() => handleEdit(row)}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}

          {row.status === 'draft' && hasPermission('purchases.approve') && (
            <button
              onClick={() => handleApproveClick(row.id)}
              className="p-1 text-purple-600 hover:bg-purple-50 rounded"
              title="Aprobar"
            >
              <Check className="h-4 w-4" />
            </button>
          )}

          {['sent', 'confirmed', 'partially_received'].includes(row.status) && hasPermission('purchases.receive') && (
            <button
              onClick={() => handleReceive(row)}
              className={`p-1 rounded ${row.status === 'partially_received'
                ? 'text-amber-600 hover:bg-amber-100'
                : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              title={row.status === 'partially_received' ? 'Continuar recepción parcial' : 'Recibir mercancía'}
            >
              {row.status === 'partially_received' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Package className="h-4 w-4" />
              )}
            </button>
          )}

          {!['received', 'cancelled'].includes(row.status) && hasPermission('purchases.delete') && (
            <button
              onClick={() => handleCancelClick(row.id)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Órdenes de Compra</h1>
          <p className="text-gray-600">Gestiona las órdenes de compra a proveedores</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Mostrar estadísticas de:</label>
          <select
            value={statsPeriod}
            onChange={(e) => setStatsPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="this_week">Esta Semana</option>
            <option value="this_month">Este Mes</option>
            <option value="last_month">Mes Anterior</option>
            <option value="last_30_days">Últimos 30 días</option>
            <option value="this_year">Este Año</option>
            <option value="all">Histórico Completo</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Órdenes</span>
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_orders || 0}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Pendientes</span>
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.pending_orders || 0}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Valor Total (COP)</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900 break-all">
              {formatMoney(calculateTotalValueInCOP(), '$', 0)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                {statsPeriod === 'this_week' ? 'Esta Semana' :
                  statsPeriod === 'this_month' ? 'Este Mes' :
                    statsPeriod === 'last_month' ? 'Mes Anterior' :
                      statsPeriod === 'last_30_days' ? 'Últimos 30 días' :
                        statsPeriod === 'this_year' ? 'Este Año' : 'Total Histórico'}
              </span>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.total_orders || 0}
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setMutationError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número, proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="confirmed">Confirmada</option>
              <option value="partially_received">Parcialmente Recibida</option>
              <option value="received">Recibida</option>
              <option value="cancelled">Cancelada</option>
            </select>

            {hasPermission('purchases.create') && (
              <button
                onClick={() => navigate('/purchase-orders/create')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Nueva Orden
              </button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={orders}
          loading={loading}
          emptyMessage="No se encontraron órdenes de compra"
          rowClassName={(row) =>
            row.status === 'partially_received'
              ? 'bg-amber-50/50 hover:bg-amber-100/50 transition-colors'
              : ''
          }
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* View Modal */}
      {showViewModal && viewingOrder && (
        <Modal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          title={`Orden de Compra: ${viewingOrder.order_number}`}
          size="xl"
        >
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Proveedor</label>
                <p className="text-gray-900">{viewingOrder.supplier?.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Almacén</label>
                <p className="text-gray-900">{viewingOrder.warehouse?.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Fecha de Orden</label>
                <p className="text-gray-900">
                  {new Date(viewingOrder.order_date).toLocaleDateString('es-PE')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Estado</label>
                <div className="mt-1 flex flex-col items-start">
                  {getStatusBadge(viewingOrder.status)}
                  {getPaymentBadge(viewingOrder.payment_status)}
                </div>
              </div>
              {viewingOrder.invoices && viewingOrder.invoices.length > 0 && (
                <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 ring-1 ring-blue-500/20">
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 block">Documentos/Facturas del Proveedor</label>
                  <div className="flex flex-wrap gap-2">
                    {viewingOrder.invoices.map((inv, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white text-blue-700 font-bold rounded-full border border-blue-200 shadow-sm text-sm">
                        #{inv}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Products Table */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Productos</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Presentación</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Ordenado</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Recibido</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Costo Unit.</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {viewingOrder.details?.map((detail) => (
                      <tr key={detail.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{detail.product?.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{detail.presentation?.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {detail.package_quantity}p + {detail.loose_units}u
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">
                          {detail.received_package_quantity}p + {detail.received_loose_units}u
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {formatMoney(detail.unit_cost, viewingOrder.currency)}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                          {formatMoney(detail.line_total, viewingOrder.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatMoney(viewingOrder.subtotal, viewingOrder.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento:</span>
                <span className="font-medium text-red-600">-{formatMoney(viewingOrder.discount_amount, viewingOrder.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Impuestos:</span>
                <span className="font-medium">{formatMoney(viewingOrder.tax_amount, viewingOrder.currency)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span className="text-blue-600">{formatMoney(viewingOrder.total, viewingOrder.currency)}</span>
              </div>
            </div>

            {/* Reception History */}
            {viewingOrder.reception_history && viewingOrder.reception_history.length > 0 && (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-green-500 rounded-full"></div>
                  Historial de Recepciones
                </h3>
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#f8fafc]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Documento</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Cantidad (U)</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Recibido por</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {viewingOrder.reception_history.map((rec) => (
                        <tr key={rec.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {new Date(rec.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="font-bold text-blue-600">{rec.document_number || viewingOrder.order_number}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center font-bold text-green-600">
                            +{parseFloat(rec.quantity).toLocaleString('de-DE')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 italic">
                            {rec.user}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment History */}
            {viewingOrder.payment_history && viewingOrder.payment_history.length > 0 && (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                  Historial de Pagos
                </h3>
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#f8fafc]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Referencia de Pago</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Método</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Monto Distribuido (OC)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {viewingOrder.payment_history.map((pay, idx) => {
                        const methodLabels = { cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque', card: 'Tarjeta', credit_balance: 'Saldo a Favor' };
                        const methodColors = { cash: 'bg-green-100 text-green-700', transfer: 'bg-blue-100 text-blue-700', check: 'bg-purple-100 text-purple-700', card: 'bg-yellow-100 text-yellow-700', credit_balance: 'bg-indigo-100 text-indigo-700', other: 'bg-gray-100 text-gray-700' };
                        const badgeColor = methodColors[pay.payment_method] || methodColors.other;
                        const label = methodLabels[pay.payment_method] || pay.payment_method;

                        return (
                          <tr key={pay.id || idx} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                              {new Date(pay.payment_date).toLocaleDateString('es-PE')}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="font-bold text-blue-600">{pay.payment_number}</span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
                                {label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                              {viewingOrder.currency} {parseFloat(pay.allocated_amount_po_currency).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {viewingOrder.notes && (
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                <label className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1 block">Notas de la Orden</label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingOrder.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
      {/* Cancellation Modal */}
      {showCancelModal && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title="Cancelar Orden de Compra"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    ¿Estás seguro de que deseas cancelar esta orden de compra? Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de la cancelación *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                rows="4"
                placeholder="Indique brevemente por qué se cancela esta orden..."
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={!cancelReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Approval Modal */}
      {showApproveModal && (
        <Modal
          isOpen={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          title="Aprobar Orden de Compra"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    ¿Estás seguro de que deseas aprobar esta orden de compra? Al hacerlo, la orden pasará a estado <strong>Enviada</strong> y podrá comenzar el proceso de recepción.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm">
              Esta acción notificará al proveedor (si está configurado) y formalizará la solicitud de mercancía para tu inventario.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApproveConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Confirmar y Aprobar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
