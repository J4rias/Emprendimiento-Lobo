import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Eye, Calendar, DollarSign, TrendingUp, ShoppingBag,
  XCircle, Printer, Smartphone, CreditCard, RefreshCcw,
} from 'lucide-react';
import { saleService } from '../services/api/saleService';
import { customerService } from '../services/api/customerService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { formatDate } from '../utils/formatUtils';
import { printSaleTicket, printSaleTicketPortable } from '../components/sales/SaleTicket';
import { useCompany } from '../context/CompanyContext';
import SaleReturnModal from '../components/sales/SaleReturnModal';
import {
  Alert, Badge, Button, Card, Modal,
  Pagination, SearchInput, Select, Table, Textarea, useTableLimit,
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

  // ─── Queries ──────────────────────────────────────────────────────────────────
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales', currentPage, limit, search, statusFilter, saleTypeFilter],
    queryFn: () => saleService.getSales({
      page: currentPage, limit,
      search,
      status: statusFilter || undefined,
      sale_type: saleTypeFilter || undefined,
    }),
    staleTime: 30_000,
  });
  const sales      = salesData?.sales || [];
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
      setSelectedSale(data.sale);
      setShowDetailModal(true);
    } catch {
      toast.error('Error al cargar el detalle de la venta');
    }
  };

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
      setReturnSale(data.sale);
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
      render: (v) => <span className="text-sm font-medium text-gray-900">{v}</span>,
    },
    {
      key: 'sale_date',
      header: 'Fecha',
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
      render: (_, row) => renderTotal(row),
    },
    {
      key: 'status',
      header: 'Estado',
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
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(row.id)} title="Ver detalle">
            <Eye className="h-4 w-4" />
          </Button>
          {(row.sale_type === 'credit' || row.sale_type === 'mixed') && row.status === 'pending' && (
            <Button variant="ghost" size="sm" onClick={() => handleOpenPaymentModal(row)} title="Abonar Pago" className="text-emerald-600 hover:bg-emerald-50">
              <CreditCard className="h-4 w-4" />
            </Button>
          )}
          {row.status === 'completed' && (
            <Button variant="ghost" size="sm" onClick={() => handleOpenReturnModal(row.id)} title="Generar Devolución" className="text-rose-600 hover:bg-rose-50">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          )}
          {row.status !== 'cancelled' && row.status !== 'returned' && (
            <Button variant="ghost" size="sm" onClick={() => handleCancelSale(row.id)} title="Cancelar venta" className="text-red-600 hover:bg-red-50">
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Gestión de Ventas</h1>
        <p className="text-gray-500">Administra y consulta todas las ventas realizadas</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                <DollarSign className="w-6 h-6 text-green-600" />
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
                <TrendingUp className="w-6 h-6 text-purple-600" />
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
      <Card variant="flat" className="mb-6">
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

      {/* ── Detail modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Detalle de Venta — ${selectedSale?.sale_number || ''}`}
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-6">
            {/* Print actions */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handlePrintTicket} className="text-blue-600 hover:bg-blue-50 border border-blue-100 text-xs font-bold">
                <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir
              </Button>
              <Button variant="ghost" size="sm" onClick={handlePrintTicketPortable} className="text-amber-600 hover:bg-amber-50 border border-amber-100 text-xs font-bold">
                <Smartphone className="w-3.5 h-3.5 mr-1" /> Portátil
              </Button>
            </div>

            {/* Sale metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
              {[
                { label: 'Fecha',    value: formatDate(selectedSale.sale_date) },
                { label: 'Cliente',  value: getCustomerName(selectedSale.customer) },
                { label: 'Vendedor', value: selectedSale.seller?.first_name || selectedSale.seller?.username || 'N/A' },
                { label: 'Almacén',  value: selectedSale.warehouse?.name },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            {/* Items */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-2 px-1">Resumen de Productos</h3>
              <div className="border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left   text-xs font-semibold text-gray-600 uppercase">Descripción</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase">Cant.</th>
                      <th className="px-4 py-2.5 text-right  text-xs font-semibold text-gray-600 uppercase">P. Unit</th>
                      <th className="px-4 py-2.5 text-right  text-xs font-semibold text-gray-600 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedSale.details?.map(detail => (
                      <tr key={detail.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{detail.product?.name}</div>
                          <div className="text-[11px] text-gray-500">{detail.presentation?.name}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600 font-medium">{parseFloat(detail.quantity)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 font-medium">{copFormat(detail.unit_price, selectedSale.exchange_rate)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{copFormat(detail.total, selectedSale.exchange_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals & payments */}
            <div className="flex flex-col md:flex-row gap-6 border-t border-gray-100 pt-6">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-800 mb-2">Historial de Pagos</h3>
                {selectedSale.payments?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSale.payments.map((p, i) => {
                      let amountCOP = parseFloat(p.amount || 0);
                      if (p.currency !== 'COP') {
                        const amountUSD = amountCOP / parseFloat(p.exchange_rate || 1);
                        amountCOP = amountUSD * parseFloat(selectedSale.exchange_rate || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1);
                      }
                      const showRate = p.currency && p.currency !== 'USD';
                      const equivUSD = showRate ? parseFloat(p.amount || 0) / parseFloat(p.exchange_rate || 1) : null;
                      return (
                        <div key={i} className="bg-slate-50 p-2 rounded space-y-0.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500">{formatDate(p.payment_date)}</span>
                            <span className="font-semibold text-slate-700 capitalize">
                              {PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method}
                            </span>
                            <span className="font-bold text-emerald-600">
                              COP {Math.ceil(amountCOP).toLocaleString('es-VE')}
                            </span>
                          </div>
                          {showRate && (
                            <div className="text-[10px] text-gray-400 pl-1">
                              {p.currency} {parseFloat(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} @ {parseFloat(p.exchange_rate).toFixed(2)} | Equiv: $ {equivUSD.toFixed(2)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No hay pagos registrados</p>
                )}
              </div>
              <div className="w-full md:w-64 space-y-2">
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-900">Total</span>
                  <span className="text-blue-600">
                    {copFormat(parseFloat(selectedSale.subtotal) - parseFloat(selectedSale.discount_amount), selectedSale.exchange_rate)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-gray-500 italic">Monto Pagado</span>
                  <span className="font-semibold text-emerald-600">{copFormat(selectedSale.paid_amount || 0, selectedSale.exchange_rate)}</span>
                </div>
              </div>
            </div>

            {selectedSale.notes && (
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                <p className="text-[11px] font-bold text-amber-800 uppercase mb-1">Notas / Observaciones</p>
                <p className="text-xs text-amber-900 whitespace-pre-wrap">{selectedSale.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

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
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-lg"
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
                <input
                  type="text"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData(p => ({ ...p, reference: e.target.value }))}
                  className="w-full h-9 px-3 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ej. #12345"
                />
              </div>
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
              <Button type="submit" loading={paymentMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
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
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
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
