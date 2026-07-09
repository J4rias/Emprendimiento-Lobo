import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supplierPaymentService } from '../services/api/supplierPaymentService';
import { supplierService } from '../services/api/supplierService';
import { CurrencyDollar, TrendUp, CreditCard, Plus } from '@phosphor-icons/react';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Pagination,
  SearchInput,
  Select,
  useTableLimit,
} from '../components/ui';
import { PaymentTable } from '../components/supplierPayments/PaymentTable';
import { PaymentFormModal } from '../components/supplierPayments/PaymentFormModal';
import { PaymentEditModal } from '../components/supplierPayments/PaymentEditModal';
import { PaymentViewModal } from '../components/supplierPayments/PaymentViewModal';
import { SupplierBalanceSummary } from '../components/supplierPayments/SupplierBalanceSummary';

// ── Opciones de filtro de método de pago ─────────────────────────────────────
const METHOD_FILTER_OPTIONS = [
  { value: '', label: 'Todos los métodos' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'check', label: 'Cheque' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'usdt', label: 'USDT' },
  { value: 'credit_balance', label: 'Saldo a Favor' },
  { value: 'other', label: 'Otro' },
];

const METHOD_LABEL = {
  cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque',
  card: 'Tarjeta', other: 'Otro', credit_balance: 'Saldo a Favor', usdt: 'USDT',
};

const SupplierPaymentsPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useTableLimit();

  // ─── Filtros y paginación ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  // ─── Queries ─────────────────────────────────────────────────────────────────

  const {
    data: paymentsData = {},
    isLoading: loadingPayments,
    isError: paymentsError,
  } = useQuery({
    queryKey: ['supplier-payments', currentPage, search, supplierFilter, paymentMethodFilter, limit],
    queryFn: async () => {
      const res = await supplierPaymentService.getAll({
        page: currentPage,
        search,
        supplier_id: supplierFilter || undefined,
        payment_method: paymentMethodFilter || undefined,
        limit,
      });
      return {
        payments: res.data || [],
        totalPages: res.totalPages || 1,
        total: res.total || 0,
      };
    },
  });

  const payments = paymentsData.payments || [];
  const totalPages = paymentsData.totalPages || 1;
  const total = paymentsData.total || 0;

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await supplierService.getAll({ limit: 1000 });
      return res.data || [];
    },
    staleTime: Infinity,
  });

  // Stats — solo cuando hay filtro de proveedor
  const { data: stats = null } = useQuery({
    queryKey: ['supplier-payment-stats', supplierFilter],
    queryFn: async () => {
      if (!supplierFilter) return null;
      const res = await supplierPaymentService.getStats({ supplier_id: supplierFilter });
      return res.data || null;
    },
    enabled: !!supplierFilter,
  });

  // Balance del proveedor — solo cuando hay filtro
  const { data: payableBalanceSummary = null } = useQuery({
    queryKey: ['supplier-payable-balance', supplierFilter],
    queryFn: async () => {
      if (!supplierFilter) return null;
      const res = await supplierPaymentService.getPayableBalance(supplierFilter);
      return res.data?.summary_by_currency || null;
    },
    enabled: !!supplierFilter,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-payment-stats'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-payable-balance'] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => supplierPaymentService.create(data),
    onSuccess: () => {
      toast.success('Pago registrado exitosamente');
      setShowCreateModal(false);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar el pago'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => supplierPaymentService.update(id, data),
    onSuccess: () => {
      toast.success('Pago actualizado exitosamente');
      setShowEditModal(false);
      setEditingPayment(null);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar el pago'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => supplierPaymentService.delete(id),
    onSuccess: () => {
      toast.success('Pago anulado exitosamente');
      setCancelTarget(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al anular el pago');
      setCancelTarget(null);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSupplierFilterChange = (value) => {
    setSupplierFilter(value);
    setCurrentPage(1);
  };

  const handleMethodFilterChange = (value) => {
    setPaymentMethodFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // Stats card 3 — método predominante
  const topMethod = stats?.payments_by_method?.reduce(
    (top, m) => (!top || m.count > top.count ? m : top),
    null
  );

  return (
    <div className="p-6">
      {/* ── Cabecera ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pagos a Proveedores</h1>
        <p className="text-gray-500 mt-1">Gestión de pagos realizados a proveedores</p>
      </div>

      {/* ── Error de carga ────────────────────────────────────────────────────── */}
      {paymentsError && (
        <Alert variant="error" className="mb-4" dismissible>
          Error al cargar los pagos. Intenta de nuevo.
        </Alert>
      )}

      {/* ── Stats (solo con proveedor seleccionado) ───────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card variant="compact" className="bg-blue-50 border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Total Pagos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total_payments}</p>
              </div>
              <CurrencyDollar className="w-10 h-10 text-blue-600 opacity-40" />
            </div>
          </Card>

          <Card variant="compact" className="bg-green-50 border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Total en USD</p>
                <p className="text-2xl font-bold text-green-900">
                  ${(
                    parseFloat(
                      stats.total_by_currency?.find((c) => c.currency === 'USD')?.total_amount || 0
                    )
                  ).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendUp className="w-10 h-10 text-green-600 opacity-40" />
            </div>
          </Card>

          <Card variant="compact" className="bg-purple-50 border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Método Principal</p>
                <p className="text-lg font-bold text-purple-900">
                  {topMethod ? METHOD_LABEL[topMethod.payment_method] || topMethod.payment_method : '—'}
                </p>
                {topMethod && (
                  <p className="text-xs text-purple-600">{topMethod.count} pagos</p>
                )}
              </div>
              <CreditCard className="w-10 h-10 text-purple-600 opacity-40" />
            </div>
          </Card>
        </div>
      )}

      {/* ── Estado de cuenta del proveedor ───────────────────────────────────── */}
      {supplierFilter && payableBalanceSummary && (
        <SupplierBalanceSummary summary={payableBalanceSummary} />
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Buscar por número de pago o referencia..."
            />
          </div>

          <div className="w-52">
            <Select
              value={supplierFilter}
              onChange={(e) => handleSupplierFilterChange(e.target.value)}
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-44">
            <Select
              value={paymentMethodFilter}
              onChange={(e) => handleMethodFilterChange(e.target.value)}
              options={METHOD_FILTER_OPTIONS}
            />
          </div>

          {hasPermission('supplier_payments.create') && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Nuevo Pago
            </Button>
          )}
        </div>
      </Card>

      {/* ── Tabla de pagos ────────────────────────────────────────────────────── */}
      <Card variant="flat" className="overflow-hidden">
        <PaymentTable
          payments={payments}
          loading={loadingPayments}
          hasPermission={hasPermission}
          onView={(p) => { setViewingPayment(p); setShowViewModal(true); }}
          onEdit={(p) => { setEditingPayment(p); setShowEditModal(true); }}
          onCancel={(p) => setCancelTarget(p)}
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

      {/* ── Modales ───────────────────────────────────────────────────────────── */}

      <PaymentFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(payload) => createMutation.mutate(payload)}
        suppliers={suppliers}
        isPending={createMutation.isPending}
      />

      <PaymentEditModal
        payment={editingPayment}
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingPayment(null); }}
        onSubmit={(data) => updateMutation.mutate({ id: editingPayment.id, data })}
        isPending={updateMutation.isPending}
      />

      <PaymentViewModal
        payment={viewingPayment}
        open={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingPayment(null); }}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget?.id)}
        loading={cancelMutation.isPending}
        variant="warning"
        title="¿Anular este pago?"
        description="El registro se conservará con estado 'Cancelado' para auditoría. Esta acción no se puede deshacer."
        confirmLabel="Anular Pago"
      />
    </div>
  );
};

export default SupplierPaymentsPage;
