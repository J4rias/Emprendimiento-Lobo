import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { toast } from 'sonner';
import {
  Calendar, CurrencyDollar, TrendUp, ShoppingBag,
  XCircle, Printer, DeviceMobile, CreditCard,
} from '@phosphor-icons/react';
import { saleService } from '../services/api/saleService';
import { customerService } from '../services/api/customerService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { formatDate } from '../utils/formatUtils';
import { printSaleTicket, printSaleTicketPortable } from '../components/sales/SaleTicket';
import { useCompany } from '../context/CompanyContext';
import SaleReturnModal from '../components/sales/SaleReturnModal';
import SaleViewSheet from '../components/sales/SaleViewSheet';
import {
  Alert, Badge, Button, Card, Input, Modal,
  Pagination, SearchInput, Select, Table, Textarea, useTableLimit,
  ViewAction, PaymentAction, ReturnAction, CancelAction,
} from '../components/ui';

// ── Status / type config ──────────────────────────────────────────────────────
const SALE_TYPE_VARIANT = { cash: 'info',    credit: 'purple', mixed: 'warning' };
const SALE_TYPE_LABEL   = { cash: 'Contado', credit: 'Crédito', mixed: 'Mixta'  };

const STATUS_VARIANT = {
  pending: 'warning', completed: 'success', cancelled: 'error', returned: 'neutral',
};
const STATUS_LABEL = {
  pending: 'Pendiente', completed: 'Completada', cancelled: 'Cancelada', returned: 'Devuelta',
};

// Status badge with credit-note dev logic
const StatusBadge = ({ status, cnCount, saleTotal, cnTotalCOP }) => {
  const cnQty   = parseInt(cnCount || 0);
  const saleNet = parseFloat(saleTotal || 0) - parseFloat(cnTotalCOP || 0);
  if (status === 'completed' && cnQty > 0) {
    return (
      <Badge variant={saleNet <= 0.01 ? 'neutral' : 'info'}>
        {saleNet <= 0.01 ? 'Dev. Total' : 'Dev. Parcial'}
      </Badge>
    );
  }
  return (
    <Badge variant={STATUS_VARIANT[status] || 'neutral'}>
      {STATUS_LABEL[status] || status}
    </Badge>
  );
};

const PAYMENT_METHOD_LABEL = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta',
  usdt: 'USDT', credit_balance: 'Monedero',
};

const SalesPage = () => {
  const { companySettings } = useCompany();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [limit, setLimit] = useTableLimit();

  // ─── Filters ──────────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [selectedSale, setSelectedSale]   = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [paymentSale, setPaymentSale]     = useState(null);
  const [paymentData, setPaymentData]     = useState({ amount_cop: '', method: 'cash', reference: '', notes: '' });
  const [customerCreditBalance, setCustomerCreditBalance] = useState({ usd: 0, cop: 0 });
  const [returnSale, setReturnSale]       = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [cancelSaleId, setCancelSaleId]   = useState(null);
  const [cancelReason, setCancelReason]   = useState('');
  const [refundLines, setRefundLines]     = useState(null); // set after cancel if refund needed

  // ─── Sort (server-side) ───────────────────────────────────────────────────────
  const { sortBy: salesSortBy, sortDir: salesSortDir, onSort: _salesOnSort } = useTableSort([], { serverSide: true, defaultField: 'sale_date', defaultDir: 'desc' });
  const salesOnSort = (f, d) => { _salesOnSort(f, d); setCurrentPage(1); };

  // ─── Queries ──────────────────────────────────────────────────────────────────
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales', currentPage, limit, search, statusFilter, saleTypeFilter, salesSortBy, salesSortDir],
    queryFn: () => saleService.getSales({
      page: currentPage, limit,
      search,
      status: statusFilter || undefined,
      sale_type: saleTypeFilter || undefined,
      sort_by: salesSortBy,
      sort_dir: salesSortDir,
    }),
    staleTime: 30_000,
  });
  const sales      = salesData?.data || [];
  const totalPages = salesData?.pagination?.totalPages || 1;
  const total      = salesData?.pagination?.total || 0;

  const { data: statsData } = useQuery({
    queryKey: ['sales-stats', statusFilter, saleTypeFilter],
    queryFn: () => saleService.getSalesStats({ status: statusFilter || undefined, sale_type: saleTypeFilter || undefined }),
    staleTime: 30_000,
  });
  const stats = statsData?.stats || null;

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => exchangeRateService.getLatest(),
    staleTime: 5 * 60_000,
  });
  const exchangeRates = ratesData?.data || [];

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const invalidateSales = () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['sales-stats'] });
  };

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => saleService.cancelSale(id, reason),
    onSuccess: (res) => {
      setCancelSaleId(null);
      setCancelReason('');
      invalidateSales();
      const lines = res?.refund_lines || [];
      const cashLines = lines.filter(l => l.payment_method === 'cash' && l.amount > 0);
      if (cashLines.length > 0) {
        setRefundLines(cashLines);
      } else {
        toast.success('Venta cancelada exitosamente');
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al cancelar la venta'),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ saleId, ...payload }) => saleService.addPayment(saleId, payload),
    onSuccess: () => {
      toast.success('Pago registrado exitosamente');
      setPaymentSale(null);
      invalidateSales();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar el pago'),
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const copFormat = (usdAmount, saleRate = null) => {
    const val  = parseFloat(usdAmount || 0);
    const rate = saleRate
      ? parseFloat(saleRate)
      : (calculateEffectiveRate('USD', 'COP', exchangeRates) || 1);
    return `COP ${Math.ceil(val * rate).toLocaleString('es-VE')}`;
  };

  const getCustomerName = (customer) => {
    if (!customer) return 'Cliente General';
    const words2 = (s) => (s || '').trim().split(/\s+/).slice(0, 2).join(' ');
    if (customer.type === 'juridical') return customer.businessName || customer.tradeName || 'Empresa Sin Nombre';
    return `${words2(customer.firstName)} ${words2(customer.lastName)}`.trim() || 'Cliente Sin Nombre';
  };

  const renderTotal = (row) => {
    const saleTotal  = parseFloat(row.total) || (parseFloat(row.subtotal) - parseFloat(row.discount_amount));
    const cnCount    = parseInt(row.cn_count || 0);
    const cnTotalCOP = parseFloat(row.cn_total_cop || 0);
    const rate       = parseFloat(row.exchange_rate || 1);
    const netCOP     = Math.ceil(saleTotal * rate) - Math.ceil(cnTotalCOP);

    if ((row.sale_type === 'credit' || row.sale_type === 'mixed') && row.status !== 'cancelled') {
      const pending = saleTotal - parseFloat(row.paid_amount || 0);
      if (pending > 0.01) {
        return (
          <div>
            <span className="text-sm font-bold text-red-600">{copFormat(pending, row.exchange_rate)}</span>
            {parseFloat(row.paid_amount || 0) > 0 && (
              <div className="text-[10px] text-gray-400">de {copFormat(saleTotal, row.exchange_rate)}</div>
            )}
            {cnCount > 0 && (
              <div className="text-[10px] text-blue-500">
                Dev: -COP {Math.ceil(cnTotalCOP).toLocaleString('es-VE')}
              </div>
            )}
          </div>
        );
      }
    }
    return (
      <div>
        <span className="text-sm font-bold text-gray-900">{copFormat(saleTotal, row.exchange_rate)}</span>
        {cnCount > 0 && (
          <div className="text-[10px] text-blue-500">
            Neto: COP {netCOP.toLocaleString('es-VE')} ({cnCount} dev.)
          </div>
        )}
      </div>
    );
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleSearchChange = (v) => { setSearch(v);            setCurrentPage(1); };
  const handleStatusChange = (e) => { setStatusFilter(e.target.value); setCurrentPage(1); };
  const handleTypeChange   = (e) => { setSaleTypeFilter(e.target.value); setCurrentPage(1); };
  const handleClear = () => {
    setSearch(''); setStatusFilter(''); setSaleTypeFilter(''); setCurrentPage(1);
  };

  const handleViewDetail = async (saleId) => {
    try {
      const data = await saleService.getSaleById(saleId);
      setSelectedSale(data.data);
      setShowDetailModal(true);
    } catch {
      toast.error('Error al cargar el detalle de la venta');
    }
  };

  // Abre el detalle directamente si se navegó desde otra página con un sale_id en state
  useEffect(() => {
    if (location.state?.openSaleId) {
      handleViewDetail(location.state.openSaleId);
      // Limpiar el state para que no se reabra al refrescar
      window.history.replaceState({}, '');
    }
  }, []);

  const handleCancelSale = (saleId) => {
    setCancelSaleId(saleId);
    setCancelReason('');
  };

  const handleOpenPaymentModal = async (sale) => {
    setPaymentSale(sale);
    setCustomerCreditBalance({ usd: 0, cop: 0 });
    const pendingUSD = parseFloat(sale.total) - parseFloat(sale.paid_amount || 0);
    const rate = parseFloat(sale.exchange_rate) || 1;
    let pendingCOP = Math.ceil(pendingUSD * rate);
    if (sale.customer_id) {
      try {
        const data = await customerService.getCreditBalance(sale.customer_id);
        if (data.credit_balance_cop > 0) {
          setCustomerCreditBalance({ usd: data.credit_balance_usd, cop: data.credit_balance_cop });
          pendingCOP = Math.max(0, pendingCOP - data.credit_balance_cop);
        }
      } catch (_) {}
    }
    setPaymentData({ amount_cop: pendingCOP > 0 ? String(pendingCOP) : '', method: 'cash', reference: '', notes: '' });
  };

  const handleOpenReturnModal = async (saleId) => {
    try {
      const data = await saleService.getSaleById(saleId);
      setReturnSale(data.data);
      setShowReturnModal(true);
    } catch {
      toast.error('Error al cargar el detalle de la venta para devolución');
    }
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    if (!paymentData.amount_cop || parseFloat(paymentData.amount_cop) <= 0) {
      return toast.error('Debe ingresar un monto válido mayor a 0');
    }
    const rate = paymentSale.exchange_rate || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;
    const payment_lines = [{
      amount: parseFloat(paymentData.amount_cop),
      method: paymentData.method,
      currency: 'COP',
      exchange_rate: rate,
      reference: paymentData.reference,
    }];
    if (customerCreditBalance.cop > 0) {
      payment_lines.push({
        amount: customerCreditBalance.cop,
        method: 'credit_balance',
        currency: 'COP',
        exchange_rate: rate,
        reference: 'Saldo a Favor Aplicado',
      });
    }
    paymentMutation.mutate({ saleId: paymentSale.id, payment_lines, notes: paymentData.notes });
  };

  const handlePrintTicket = () => {
    if (selectedSale) {
      printSaleTicket(selectedSale, companySettings, {
        displayCurrency: 'COP',
        exchangeRate: selectedSale.exchange_rate || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1,
      });
    }
  };

  const handlePrintTicketPortable = () => {
    if (selectedSale) {
      printSaleTicketPortable(selectedSale, companySettings, {
        displayCurrency: 'COP',
        exchangeRate: selectedSale.exchange_rate || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1,
      });
    }
  };

  // ─── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'sale_number',
      header: 'Número',
      sortable: true,
      sortKey: 'sale_number',
      render: (v) => <span className="text-sm font-medium text-gray-900">{v}</span>,
    },
    {
      key: 'sale_date',
      header: 'Fecha',
      sortable: true,
      sortKey: 'sale_date',
      render: (v) => (
        <span className="text-sm text-gray-600">
          {new Date(v).toLocaleDateString('es-VE', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_, row) => (
        <span className="text-sm text-gray-900 font-medium block truncate max-w-[200px]" title={getCustomerName(row.customer)}>
          {getCustomerName(row.customer)}
        </span>
      ),
    },
    {
      key: 'sale_type',
      header: 'Tipo',
      render: (v) => <Badge variant={SALE_TYPE_VARIANT[v] || 'neutral'}>{SALE_TYPE_LABEL[v] || v}</Badge>,
    },
    {
      key: 'total',
      header: 'Total / Pendiente',
      sortable: true,
      sortKey: 'total',
      render: (_, row) => renderTotal(row),
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      sortKey: 'status',
      render: (_, row) => (
        <StatusBadge
          status={row.status}
          cnCount={row.cn_count}
          saleTotal={parseFloat(row.total || 0) * parseFloat(row.exchange_rate || 1)}
          cnTotalCOP={row.cn_total_cop}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <ViewAction onClick={() => handleViewDetail(row.id)} />
          {(row.sale_type === 'credit' || row.sale_type === 'mixed') && row.status === 'pending' && (
            <PaymentAction onClick={() => handleOpenPaymentModal(row)} title="Abonar Pago" />
          )}
          {row.status === 'completed' && (
            <ReturnAction onClick={() => handleOpenReturnModal(row.id)} />
          )}
          {row.status !== 'cancelled' && row.status !== 'returned' && (
            <CancelAction onClick={() => handleCancelSale(row.id)} title="Cancelar venta" />
          )}
        </div>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Ventas</h1>
        <p className="text-gray-500 mt-1">Administra y consulta todas las ventas realizadas</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Ventas</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalSales || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card variant="compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ingresos Totales</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.totalRevenueCOP != null
                    ? `COP ${Math.ceil(stats.totalRevenueCOP).toLocaleString('es-VE')}`
                    : copFormat(stats.totalRevenue || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CurrencyDollar className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
          <Card variant="compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ventas Contado</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.salesByType?.find(s => s.sale_type === 'cash')?.count || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
          <Card variant="compact">
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
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card variant="flat">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Buscar por número de venta o cliente..."
            />
          </div>
          <div className="w-48">
            <Select value={statusFilter} onChange={handleStatusChange}>
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </Select>
          </div>
          <div className="w-44">
            <Select value={saleTypeFilter} onChange={handleTypeChange}>
              <option value="">Todos los tipos</option>
              <option value="cash">Contado</option>
              <option value="credit">Crédito</option>
              <option value="mixed">Mixta</option>
            </Select>
          </div>
          <Button variant="secondary" onClick={handleClear}>Limpiar</Button>
        </div>
      </Card>

      {/* Table */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={sales}
          loading={isLoading}
          emptyMessage="No se encontraron ventas"
          sortBy={salesSortBy}
          sortDir={salesSortDir}
          onSort={salesOnSort}
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

      {/* ── Detail sheet ──────────────────────────────────────────────────────── */}
      <SaleViewSheet
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        sale={selectedSale}
        onPrint={handlePrintTicket}
        onPrintPortable={handlePrintTicketPortable}
        exchangeRates={exchangeRates}
        calculateEffectiveRate={calculateEffectiveRate}
      />

      {/* ── Payment modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!paymentSale}
        onClose={() => !paymentMutation.isPending && setPaymentSale(null)}
        title={`Registrar Abono — ${paymentSale?.sale_number || ''}`}
        size="md"
      >
        {paymentSale && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center">
              <div>
                <p className="text-xs text-emerald-800 font-semibold">Saldo Pendiente (Aprox)</p>
                <p className="text-lg font-bold text-emerald-900">
                  {copFormat(parseFloat(paymentSale.total) - parseFloat(paymentSale.paid_amount || 0), paymentSale.exchange_rate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-800 font-semibold">Cliente</p>
                <p className="text-sm font-medium text-emerald-900 truncate max-w-[150px]">
                  {paymentSale.customer?.name || 'Cliente'}
                </p>
              </div>
            </div>

            {customerCreditBalance.cop > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 flex justify-between items-center">
                <div>
                  <p className="text-xs text-blue-800 font-semibold">Saldo a Favor del Cliente</p>
                  <p className="text-lg font-bold text-blue-900">
                    COP {Math.ceil(customerCreditBalance.cop).toLocaleString('es-VE')}
                  </p>
                </div>
                <div className="text-right text-xs text-blue-700">
                  <p>Descontado del</p>
                  <p>monto a pagar</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto a Abonar (COP)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={paymentData.amount_cop}
                  onChange={(e) => setPaymentData(p => ({ ...p, amount_cop: e.target.value }))}
                  className="w-full pl-8 pr-4 h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 font-medium text-lg"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Método de Pago"
                required
                value={paymentData.method}
                onChange={(e) => setPaymentData(p => ({ ...p, method: e.target.value }))}
              >
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta / Punto</option>
                <option value="transfer">Transferencia</option>
              </Select>
              <Input
                label="Referencia"
                type="text"
                value={paymentData.reference}
                onChange={(e) => setPaymentData(p => ({ ...p, reference: e.target.value }))}
                placeholder="Ej. #12345"
              />
            </div>

            <Textarea
              label="Notas adicionales"
              value={paymentData.notes}
              onChange={(e) => setPaymentData(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Observaciones sobre el pago..."
            />

            <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPaymentSale(null)} disabled={paymentMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" variant="success" loading={paymentMutation.isPending}>
                <CreditCard className="w-4 h-4" /> Registrar Abono
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Cancel modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!cancelSaleId}
        onClose={() => !cancelMutation.isPending && setCancelSaleId(null)}
        title="Cancelar Venta"
        size="sm"
      >
        <div className="space-y-4">
          <Alert variant="error">
            Esta acción no se puede deshacer. Ingrese el motivo de la cancelación.
          </Alert>
          <Textarea
            label="Motivo *"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ej: Error en el pedido, cliente canceló..."
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={() => setCancelSaleId(null)} disabled={cancelMutation.isPending}>
              Cerrar
            </Button>
            <Button
              variant="danger-outline"
              onClick={() => cancelMutation.mutate({ id: cancelSaleId, reason: cancelReason.trim() })}
              loading={cancelMutation.isPending}
              disabled={!cancelReason.trim()}
            >
              <XCircle className="w-4 h-4" /> Confirmar Cancelación
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Refund modal — shown after cancelling a cash sale ────────────────── */}
      <Modal
        open={!!refundLines}
        onClose={() => setRefundLines(null)}
        title="Devolver al Cliente"
        size="sm"
      >
        <div className="space-y-4">
          <Alert variant="error">
            La venta fue cancelada. Devuelva el efectivo recibido al cliente.
          </Alert>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
            {(refundLines || []).map((line, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-3 bg-white">
                <span className="text-sm text-gray-600">
                  {line.currency === 'COP' ? 'Efectivo COP' :
                   line.currency === 'USD' ? 'Efectivo USD' :
                   `Efectivo ${line.currency}`}
                </span>
                <span className="font-bold text-lg text-gray-900">
                  {line.currency === 'USD'
                    ? `$ ${parseFloat(line.amount).toFixed(2)}`
                    : Math.ceil(line.amount).toLocaleString('es-VE')}
                  {' '}{line.currency}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2 border-t border-gray-200">
            <Button onClick={() => { setRefundLines(null); toast.success('Venta cancelada exitosamente'); }}>
              Confirmar devolución
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Return modal (componente externo) ────────────────────────────────── */}
      <SaleReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        sale={returnSale}
        onReturnSuccess={() => {
          setShowReturnModal(false);
          invalidateSales();
        }}
      />
    </div>
  );
};

export default SalesPage;
