import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { supplierService } from '../services/api/supplierService';
import { formatMoney } from '../utils/formatUtils';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { toast } from 'sonner';
import {
  Plus, XCircle, FileText,
  CurrencyDollar, TrendUp, Clock,
} from '@phosphor-icons/react';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Modal,
  Pagination, SearchInput, Select, Table, Textarea, useTableLimit,
  ViewAction, PaymentAction, EditAction, ApproveAction,
  ReceiveAction, PartialReceiveAction, CancelAction,
} from '../components/ui';
import PurchaseOrderViewSheet from '../components/purchaseOrders/PurchaseOrderViewSheet';

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
  cash: 'bg-green-100 text-green-700', transfer: 'bg-primary-100 text-primary-700',
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

  // ─── Sort (server-side) ───────────────────────────────────────────────────────
  const { sortBy: ordersSortBy, sortDir: ordersSortDir, onSort: _ordersOnSort } = useTableSort([], { serverSide: true, defaultField: 'created_at', defaultDir: 'desc' });
  const ordersOnSort = (f, d) => { _ordersOnSort(f, d); setCurrentPage(1); };

  // ─── Queries ──────────────────────────────────────────────────────────────────
  const { data: ordersData, isLoading, isError: fetchError } = useQuery({
    queryKey: ['purchase-orders', currentPage, search, statusFilter, supplierFilter, limit, ordersSortBy, ordersSortDir],
    queryFn: () => purchaseOrderService.getAll({
      page: currentPage, limit,
      search: search || undefined,
      status: statusFilter || undefined,
      supplier_id: supplierFilter || undefined,
      sort_by: ordersSortBy,
      sort_dir: ordersSortDir,
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
      sortable: true,
      sortKey: 'order_number',
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
      sortable: true,
      sortKey: 'order_date',
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
      sortable: true,
      sortKey: 'total',
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
      sortable: true,
      sortKey: 'status',
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
      className: 'w-px',
      render: (_, row) => (
        <div className="flex gap-1">
          <ViewAction onClick={() => handleView(row)} />
          {['partially_received', 'received'].includes(row.status) && hasPermission('supplier_payments.create') && (
            <PaymentAction
              onClick={() => navigate('/supplier-payments', { state: { prefillOrder: row } })}
              title="Registrar Pago"
            />
          )}
          {row.status === 'draft' && hasPermission('purchases.update') && (
            <EditAction onClick={() => navigate(`/purchase-orders/edit/${row.id}`)} />
          )}
          {row.status === 'draft' && hasPermission('purchases.approve') && (
            <ApproveAction onClick={() => setApprovingOrderId(row.id)} />
          )}
          {['sent', 'confirmed', 'partially_received'].includes(row.status) && hasPermission('purchases.receive') && (
            row.status === 'partially_received'
              ? <PartialReceiveAction onClick={() => navigate(`/purchase-orders/receive/${row.id}`)} />
              : <ReceiveAction onClick={() => navigate(`/purchase-orders/receive/${row.id}`)} />
          )}
          {!['received', 'cancelled'].includes(row.status) && hasPermission('purchases.delete') && (
            <CancelAction onClick={() => { setCancellingOrderId(row.id); setCancelReason(''); }} />
          )}
        </div>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="compact">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Órdenes</span>
              <FileText className="w-5 h-5 text-primary-600" />
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
              <CurrencyDollar className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900 break-all">
              {formatMoney(totalValueInCOP(), '$', 0)}
            </p>
          </Card>
          <Card variant="compact">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{PERIOD_LABELS[statsPeriod]}</span>
              <TrendUp className="w-5 h-5 text-purple-600" />
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
      <Card variant="flat" >
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
          sortBy={ordersSortBy}
          sortDir={ordersSortDir}
          onSort={ordersOnSort}
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

      {/* ── View sheet ────────────────────────────────────────────────────────── */}
      <PurchaseOrderViewSheet
        open={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingOrder(null); }}
        order={viewingOrder}
      />

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
