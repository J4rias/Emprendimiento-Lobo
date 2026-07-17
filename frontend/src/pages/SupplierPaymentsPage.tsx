import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supplierPaymentService } from '../services/api/supplierPaymentService';
import { supplierService } from '../services/api/supplierService';
import { CurrencyDollar, TrendUp, CreditCard, Plus } from '@phosphor-icons/react';
import { formatUSD } from '../utils/formatUtils';
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
import { PaymentViewSheet } from '../components/supplierPayments/PaymentViewSheet';
import { SupplierBalanceSummary } from '../components/supplierPayments/SupplierBalanceSummary';

// ── Tipos locales derivados del uso ──────────────────────────────────────────
interface SupplierPayment {
  id: number;
  [key: string]: unknown;
}

interface PaymentEditForm extends Record<string, unknown> {}

interface Supplier {
  id: number;
  name: string;
  [key: string]: unknown;
}

interface PaymentStats {
  total_payments: number;
  total_by_currency?: { currency: string; total_amount: number }[];
  payments_by_method?: { payment_method: string; count: number }[];
  [key: string]: unknown;
}

interface PaymentsListResponse {
  payments: SupplierPayment[];
  totalPages: number;
  total: number;
}

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

const METHOD_LABEL: Record<string, string> = {
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
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const onSort = (f: string) => {
    if (sortBy === f) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(f);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<SupplierPayment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SupplierPayment | null>(null);

  // ─── Queries ─────────────────────────────────────────────────────────────────

  const {
    data: paymentsData = {} as PaymentsListResponse,
    isLoading: loadingPayments,
    isError: paymentsError,
  } = useQuery({
    queryKey: ['supplier-payments', currentPage, search, supplierFilter, paymentMethodFilter, limit, sortBy, sortDir],
    queryFn: async () => {
      const res = await supplierPaymentService.getAll({
        page: currentPage,
        search,
        supplier_id: supplierFilter || undefined,
        payment_method: paymentMethodFilter || undefined,
        limit,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      return {
        payments: res.data || [],
        totalPages: res.pagination?.totalPages || 1,
        total: res.pagination?.total || 0,
      } as PaymentsListResponse;
    },
  });

  const payments = paymentsData.payments || [];
  const totalPages = paymentsData.totalPages || 1;
  const total = paymentsData.total || 0;

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await supplierService.getAll({ limit: 1000 });
      return (res.data || []) as Supplier[];
    },
    staleTime: Infinity,
  });

  // Stats — solo cuando hay filtro de proveedor
  const { data: stats = null } = useQuery<PaymentStats | null>({
    queryKey: ['supplier-payment-stats', supplierFilter],
    queryFn: async () => {
      if (!supplierFilter) return null;
      const res = await supplierPaymentService.getStats({ supplier_id: supplierFilter });
      return (res.data || null) as PaymentStats | null;
    },
    enabled: !!supplierFilter,
  });

  // Balance del proveedor — solo cuando hay filtro
  const { data: payableBalanceSummary = null } = useQuery({
    queryKey: ['supplier-payable-balance', supplierFilter],
    queryFn: async () => {
      if (!supplierFilter) return null;
      const res = await supplierPaymentService.getPayableBalance(Number(supplierFilter));
      return res.data?.summary_by_currency || null;
    },
    enabled: !!supplierFilter,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-payment-stats'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-payable-balance'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-resumen'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => supplierPaymentService.create(data),
    onSuccess: () => {
      toast.success('Pago registrado exitosamente');
      setShowCreateModal(false);
      invalidate();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al registrar el pago');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; data: PaymentEditForm }) => supplierPaymentService.update(params.id, params.data),
    onSuccess: () => {
      toast.success('Pago actualizado exitosamente');
      setShowEditModal(false);
      setEditingPayment(null);
      invalidate();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al actualizar el pago');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => supplierPaymentService.delete(id),
    onSuccess: () => {
      toast.success('Pago anulado exitosamente');
      setCancelTarget(null);
      invalidate();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al anular el pago');
      setCancelTarget(null);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSupplierFilterChange = (value: string) => {
    setSupplierFilter(value);
    setCurrentPage(1);
  };

  const handleMethodFilterChange = (value: string) => {
    setPaymentMethodFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // Stats card 3 — método predominante
  const topMethod = stats?.payments_by_method?.reduce(
    (top: { payment_method: string; count: number } | null, m: { payment_method: string; count: number }) => (!top || m.count > top.count ? m : top),
    null
  );

  return (
    <div className="space-y-6">
      {/* ── Cabecera ──────────────────────────────────────────────────────────── */}
      <div>
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card variant="compact" className="bg-primary-50 border-primary-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-700">Total Pagos</p>
                <p className="text-2xl font-bold text-primary-900">{stats.total_payments}</p>
              </div>
              <CurrencyDollar className="w-10 h-10 text-primary-600 opacity-40" />
            </div>
          </Card>

          <Card variant="compact" className="bg-green-50 border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Total en USD</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatUSD(
                    stats.total_by_currency?.find((c: { currency: string; total_amount: number }) => c.currency === 'USD')?.total_amount || 0
                  )}
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
      <Card variant="flat">
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
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSupplierFilterChange(e.target.value)}
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((s: Supplier) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-44">
            <Select
              value={paymentMethodFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleMethodFilterChange(e.target.value)}
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
          payments={payments as any[]}
          loading={loadingPayments}
          hasPermission={hasPermission}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort as (key: string) => void}
          onView={(p: any) => setViewingPayment(p as SupplierPayment)}
          onEdit={(p: any) => { setEditingPayment(p as SupplierPayment); setShowEditModal(true); }}
          onCancel={(p: any) => setCancelTarget(p as SupplierPayment)}
        />
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setCurrentPage}
          onLimitChange={(l: number) => { setLimit(l); setCurrentPage(1); }}
        />
      </Card>

      {/* ── Modales ───────────────────────────────────────────────────────────── */}

      <PaymentFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(payload: Record<string, unknown>) => createMutation.mutate(payload)}
        suppliers={suppliers as any[]}
        isPending={createMutation.isPending}
      />

      <PaymentEditModal
        payment={editingPayment as any}
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingPayment(null); }}
        onSubmit={(data: any) => updateMutation.mutate({ id: editingPayment!.id, data })}
        isPending={updateMutation.isPending}
      />

      <PaymentViewSheet
        payment={viewingPayment as any}
        open={!!viewingPayment}
        onClose={() => setViewingPayment(null)}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget?.id as number)}
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
