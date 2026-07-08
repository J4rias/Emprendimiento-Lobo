import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { supplierService } from '../services/api/supplierService';
import { formatMoney } from '../utils/formatUtils';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { toast } from 'sonner';
import {
  Plus, Eye, Edit, Check, X, Package, FileText,
  DollarSign, TrendingUp, Clock, AlertCircle, XCircle, CreditCard,
} from 'lucide-react';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Modal,
  Pagination, SearchInput, Select, Table, Textarea, useTableLimit,
} from '../components/ui';

// ── Status / payment config ───────────────────────────────────────────────────
const STATUS_VARIANT = {
  draft: 'neutral', sent: 'info', confirmed: 'purple',
  partially_received: 'warning', received: 'success', cancelled: 'error',
};
const STATUS_LABEL = {
  draft: 'Borrador', sent: 'Enviada', confirmed: 'Confirmada',
  partially_received: 'Parcialmente Recibida', received: 'Recibida', cancelled: 'Cancelada',
};
const PAYMENT_VARIANT = { paid: 'success', partial: 'info', pending: 'neutral' };
const PAYMENT_LABEL  = { paid: 'Pagada',   partial: 'Abonada', pending: 'Pendiente Pago' };

const PAYMENT_METHOD_LABEL = {
  cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque',
  card: 'Tarjeta', credit_balance: 'Saldo a Favor', usdt: 'USDT',
};
const PAYMENT_METHOD_COLOR = {
  cash: 'bg-green-100 text-green-700', transfer: 'bg-blue-100 text-blue-700',
  check: 'bg-purple-100 text-purple-700', card: 'bg-yellow-100 text-yellow-700',
  credit_balance: 'bg-indigo-100 text-indigo-700', usdt: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-700',
};

const PERIOD_LABELS = {
  this_week: 'Esta Semana', this_month: 'Este Mes', last_month: 'Mes Anterior',
  last_30_days: 'Últimos 30 días', this_year: 'Este Año', all: 'Total Histórico',
};

// ── Date range helper ─────────────────────────────────────────────────────────
const getDateRange = (period) => {
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (period === 'all') return {};
  if (period === 'this_week') {
    const d = start.getDay(); start.setDate(start.getDate() - (d === 0 ? 6 : d - 1));
  } else if (period === 'this_month') {
    start.setDate(1);
  } else if (period === 'last_month') {
    start.setMonth(start.getMonth() - 1); start.setDate(1);
    today.setTime(new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999).getTime());
  } else if (period === 'last_30_days') {
    start.setDate(start.getDate() - 30);
  } else if (period === 'this_year') {
    start.setMonth(0, 1);
  }
  return { date_from: start.toISOString(), date_to: today.toISOString() };
};

const PurchaseOrdersPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useTableLimit();

  // ─── Filters ──────────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [statsPeriod, setStatsPeriod]   = useState('this_week');

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingOrder, setViewingOrder]   = useState(null);
  const [approvingOrderId, setApprovingOrderId] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // ─── Queries ──────────────────────────────────────────────────────────────────
  const { data: ordersData, isLoading, isError: fetchError } = useQuery({
    queryKey: ['purchase-orders', currentPage, search, statusFilter, supplierFilter, limit],
    queryFn: () => purchaseOrderService.getAll({
      page: currentPage, limit,
      search: search || undefined,
      status: statusFilter || undefined,
      supplier_id: supplierFilter || undefined,
    }),
    staleTime: 30_000,
  });
  const orders     = ordersData?.data || [];
  const totalPages = ordersData?.pagination?.totalPages || 1;
  const total      = ordersData?.pagination?.total || 0;

  const { data: statsData } = useQuery({
    queryKey: ['purchase-orders-stats', statsPeriod],
    queryFn: () => purchaseOrderService.getStats(getDateRange(statsPeriod)),
    staleTime: 30_000,
  });
  const stats = statsData?.data || null;

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => supplierService.getActive(),
    staleTime: 5 * 60_000,
  });
  const suppliers = suppliersData?.data || [];

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => exchangeRateService.getLatest(),
    staleTime: 5 * 60_000,
  });
  const exchangeRates = ratesData?.data || [];

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-orders-stats'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id) => purchaseOrderService.approve(id),
    onSuccess: () => {
      toast.success('Orden aprobada exitosamente');
      setApprovingOrderId(null);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al aprobar la orden'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => purchaseOrderService.cancel(id, reason),
    onSuccess: () => {
      toast.success('Orden cancelada exitosamente');
      setCancellingOrderId(null);
      setCancelReason('');
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al cancelar la orden'),
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const copFormat = (amount, currency) => {
    const val = parseFloat(amount || 0);
    if (currency === 'COP') return `COP ${Math.ceil(val).toLocaleString('es-VE')}`;
    const rate = calculateEffectiveRate(currency, 'COP', exchangeRates) || 1;
    return `COP ${Math.ceil(val * rate).toLocaleString('es-VE')}`;
  };

  const totalValueInCOP = () => {
    if (!stats?.value_by_currency) return 0;
    return stats.value_by_currency.reduce((sum, item) => {
      if (item.currency === 'COP') return sum + parseFloat(item.total || 0);
      const rate = calculateEffectiveRate(item.currency, 'COP', exchangeRates) || 1;
      return sum + parseFloat(item.total || 0) * rate;
    }, 0);
  };

  const handleView = async (order) => {
    try {
      const res = await purchaseOrderService.getById(order.id);
      setViewingOrder(res.data);
      setShowViewModal(true);
    } catch {
      toast.error('Error al cargar el detalle de la orden');
    }
  };

  const handleSearchChange   = (v) => { setSearch(v);                    setCurrentPage(1); };
  const handleStatusChange   = (e) => { setStatusFilter(e.target.value); setCurrentPage(1); };
  const handleSupplierChange = (e) => { setSupplierFilter(e.target.value); setCurrentPage(1); };

  // ─── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'order_number',
      header: 'Número',
      render: (v) => <div className="font-medium text-gray-900">{v}</div>,
    },
    {
      key: 'supplier',
      header: 'Proveedor',
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.supplier?.name}</div>
          <div className="text-xs text-gray-500">{row.supplier?.code}</div>
        </div>
      ),
    },
    {
      key: 'order_date',
      header: 'Fecha',
      render: (v) => (
        <div className="text-sm text-gray-600">{new Date(v).toLocaleDateString('es-VE')}</div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Almacén',
      render: (_, row) => <div className="text-sm text-gray-600">{row.warehouse?.name}</div>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{formatMoney(row.total, row.currency)}</span>
          {row.currency !== 'COP' && (
            <span className="text-xs text-emerald-600 font-medium mt-0.5">
              ≈ {copFormat(row.total, row.currency)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (_, row) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant={STATUS_VARIANT[row.status] || 'neutral'}>
            {STATUS_LABEL[row.status] || row.status}
          </Badge>
          {['received', 'partially_received', 'confirmed'].includes(row.status) && row.payment_status && PAYMENT_LABEL[row.payment_status] && (
            <Badge variant={PAYMENT_VARIANT[row.payment_status] || 'neutral'}>
              {PAYMENT_LABEL[row.payment_status]}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleView(row)} title="Ver detalles">
            <Eye className="h-4 w-4" />
          </Button>
          {['partially_received', 'received'].includes(row.status) && hasPermission('supplier_payments.create') && (
            <Button
              variant="ghost" size="sm"
              onClick={() => navigate('/supplier-payments', { state: { prefillOrder: row } })}
              title="Registrar Pago"
              className="text-emerald-600 hover:bg-emerald-50"
            >
              <CreditCard className="h-4 w-4" />
            </Button>
          )}
          {row.status === 'draft' && hasPermission('purchases.update') && (
            <Button
              variant="ghost" size="sm"
              onClick={() => navigate(`/purchase-orders/edit/${row.id}`)}
              title="Editar"
              className="text-green-600 hover:bg-green-50"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {row.status === 'draft' && hasPermission('purchases.approve') && (
            <Button
              variant="ghost" size="sm"
              onClick={() => setApprovingOrderId(row.id)}
              title="Aprobar"
              className="text-purple-600 hover:bg-purple-50"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          {['sent', 'confirmed', 'partially_received'].includes(row.status) && hasPermission('purchases.receive') && (
            <Button
              variant="ghost" size="sm"
              onClick={() => navigate(`/purchase-orders/receive/${row.id}`)}
              title={row.status === 'partially_received' ? 'Continuar recepción parcial' : 'Recibir mercancía'}
              className={row.status === 'partially_received' ? 'text-amber-600 hover:bg-amber-100' : 'text-indigo-600 hover:bg-indigo-50'}
            >
              {row.status === 'partially_received'
                ? <AlertCircle className="h-4 w-4" />
                : <Package className="h-4 w-4" />}
            </Button>
          )}
          {!['received', 'cancelled'].includes(row.status) && hasPermission('purchases.delete') && (
            <Button
              variant="ghost" size="sm"
              onClick={() => { setCancellingOrderId(row.id); setCancelReason(''); }}
              title="Cancelar"
              className="text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Órdenes de Compra</h1>
          <p className="text-gray-500">Gestiona las órdenes de compra a proveedores</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Estadísticas de:</label>
          <Select
            value={statsPeriod}
            onChange={(e) => setStatsPeriod(e.target.value)}
            className="w-48"
          >
            <option value="this_week">Esta Semana</option>
            <option value="this_month">Este Mes</option>
            <option value="last_month">Mes Anterior</option>
            <option value="last_30_days">Últimos 30 días</option>
            <option value="this_year">Este Año</option>
            <option value="all">Histórico Completo</option>
          </Select>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card variant="compact">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Órdenes</span>
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_orders || 0}</p>
          </Card>
          <Card variant="compact">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Pendientes</span>
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.pending_orders || 0}</p>
          </Card>
          <Card variant="compact">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Valor Total (COP)</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900 break-all">
              {formatMoney(totalValueInCOP(), '$', 0)}
            </p>
          </Card>
          <Card variant="compact">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{PERIOD_LABELS[statsPeriod]}</span>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_orders || 0}</p>
          </Card>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <Alert variant="error" className="mb-4" dismissible>
          Error al cargar las órdenes de compra. Intenta de nuevo.
        </Alert>
      )}

      {/* Filters */}
      <Card variant="flat" className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Buscar por número, proveedor..."
            />
          </div>
          <div className="w-52">
            <Select value={supplierFilter} onChange={handleSupplierChange}>
              <option value="">Todos los proveedores</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="w-52">
            <Select value={statusFilter} onChange={handleStatusChange}>
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="confirmed">Confirmada</option>
              <option value="partially_received">Parcialmente Recibida</option>
              <option value="received">Recibida</option>
              <option value="cancelled">Cancelada</option>
            </Select>
          </div>
          {hasPermission('purchases.create') && (
            <Button onClick={() => navigate('/purchase-orders/create')}>
              <Plus className="h-4 w-4" /> Nueva Orden
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={orders}
          loading={isLoading}
          emptyMessage="No se encontraron órdenes de compra"
          rowClassName={(row) =>
            row.status === 'partially_received'
              ? 'bg-amber-50/50 hover:bg-amber-100/50 transition-colors'
              : ''
          }
        />
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setCurrentPage}
          onLimitChange={(l) => { setLimit(l); setCurrentPage(1); }}
        />
      </Card>

      {/* ── View modal ────────────────────────────────────────────────────────── */}
      <Modal
        open={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingOrder(null); }}
        title={viewingOrder ? `Orden de Compra: ${viewingOrder.order_number}` : ''}
        size="xl"
      >
        {viewingOrder && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Proveedor</p>
                <p className="text-gray-900">{viewingOrder.supplier?.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Almacén</p>
                <p className="text-gray-900">{viewingOrder.warehouse?.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Fecha de Orden</p>
                <p className="text-gray-900">
                  {new Date(viewingOrder.order_date).toLocaleDateString('es-VE')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Estado</p>
                <div className="mt-1 flex flex-col items-start gap-1">
                  <Badge variant={STATUS_VARIANT[viewingOrder.status] || 'neutral'}>
                    {STATUS_LABEL[viewingOrder.status] || viewingOrder.status}
                  </Badge>
                  {viewingOrder.payment_status && PAYMENT_LABEL[viewingOrder.payment_status] && (
                    <Badge variant={PAYMENT_VARIANT[viewingOrder.payment_status] || 'neutral'}>
                      {PAYMENT_LABEL[viewingOrder.payment_status]}
                    </Badge>
                  )}
                </div>
              </div>
              {viewingOrder.invoices?.length > 0 && (
                <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 ring-1 ring-blue-500/20">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
                    Documentos / Facturas del Proveedor
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {viewingOrder.invoices.map((inv, i) => (
                      <span key={i} className="px-3 py-1 bg-white text-blue-700 font-bold rounded-full border border-blue-200 shadow-sm text-sm">
                        #{inv}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Products table */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Productos</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Producto', 'Presentación', 'Ordenado', 'Recibido', 'Costo Unit.', 'Total'].map(h => (
                        <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-500 ${['Ordenado','Recibido','Costo Unit.','Total'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {viewingOrder.details?.map(d => (
                      <tr key={d.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{d.product?.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{d.presentation?.name}</td>
                        <td className="px-4 py-2 text-sm text-right">{d.package_quantity}p + {d.loose_units}u</td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">{d.received_package_quantity}p + {d.received_loose_units}u</td>
                        <td className="px-4 py-2 text-sm text-right">{formatMoney(d.unit_cost, viewingOrder.currency)}</td>
                        <td className="px-4 py-2 text-sm font-medium text-right">{formatMoney(d.line_total, viewingOrder.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {[
                { label: 'Subtotal', value: formatMoney(viewingOrder.subtotal, viewingOrder.currency) },
                { label: 'Descuento', value: `-${formatMoney(viewingOrder.discount_amount, viewingOrder.currency)}`, cls: 'text-red-600' },
                { label: 'Impuestos', value: formatMoney(viewingOrder.tax_amount, viewingOrder.currency) },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-600">{label}:</span>
                  <span className={`font-medium ${cls || ''}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span className="text-blue-600">{formatMoney(viewingOrder.total, viewingOrder.currency)}</span>
              </div>
            </div>

            {/* Reception history */}
            {viewingOrder.reception_history?.length > 0 && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                  Historial de Recepciones
                </h3>
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#f8fafc]">
                      <tr>
                        {['Fecha', 'Documento', 'Cantidad (U)', 'Recibido por'].map((h, i) => (
                          <th key={h} className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase ${i === 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {viewingOrder.reception_history.map(rec => (
                        <tr key={rec.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {new Date(rec.date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-blue-600">
                            {rec.document_number || viewingOrder.order_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-center font-bold text-green-600">
                            +{parseFloat(rec.quantity).toLocaleString('es-VE')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 italic">{rec.user}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment history */}
            {viewingOrder.payment_history?.length > 0 && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  Historial de Pagos
                </h3>
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#f8fafc]">
                      <tr>
                        {['Fecha', 'Referencia de Pago', 'Método', 'Monto Distribuido (OC)'].map((h, i) => (
                          <th key={h} className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {viewingOrder.payment_history.map((pay, i) => (
                        <tr key={pay.id || i} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                            {new Date(pay.payment_date).toLocaleDateString('es-VE')}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-blue-600">{pay.payment_number}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${PAYMENT_METHOD_COLOR[pay.payment_method] || PAYMENT_METHOD_COLOR.other}`}>
                              {PAYMENT_METHOD_LABEL[pay.payment_method] || pay.payment_method}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                            {viewingOrder.currency} {parseFloat(pay.allocated_amount_po_currency).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {viewingOrder.notes && (
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Notas de la Orden</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingOrder.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Cancel modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!cancellingOrderId}
        onClose={() => { setCancellingOrderId(null); setCancelReason(''); }}
        title="Cancelar Orden de Compra"
        size="md"
      >
        <div className="space-y-4">
          <Alert variant="error">
            ¿Estás seguro de que deseas cancelar esta orden? Esta acción no se puede deshacer.
          </Alert>
          <Textarea
            label="Motivo de la cancelación *"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={4}
            placeholder="Indique brevemente por qué se cancela esta orden..."
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setCancellingOrderId(null); setCancelReason(''); }}>
              Cerrar
            </Button>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => cancelMutation.mutate({ id: cancellingOrderId, reason: cancelReason })}
              loading={cancelMutation.isPending}
              disabled={!cancelReason.trim()}
            >
              <XCircle className="h-4 w-4" /> Confirmar Cancelación
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Approve confirm dialog ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!approvingOrderId}
        onClose={() => setApprovingOrderId(null)}
        onConfirm={() => approveMutation.mutate(approvingOrderId)}
        loading={approveMutation.isPending}
        title="Aprobar Orden de Compra"
        description="La orden pasará a estado Enviada y podrá comenzar el proceso de recepción de mercancía."
        confirmLabel="Confirmar y Aprobar"
      />
    </div>
  );
};

export default PurchaseOrdersPage;
