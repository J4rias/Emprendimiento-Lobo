import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { toast } from 'sonner';
import {
  Calendar, CurrencyDollar, TrendUp, ShoppingBag,
  XCircle, Printer, DeviceMobile, FileCsv,
} from '@phosphor-icons/react';
import { saleService } from '../services/api/saleService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { convertPaymentLinesToBackend, adjustPaymentLinesForChange, PaymentLine as PaymentLineUtil } from '../utils/paymentUtils';
import { COP_TOLERANCE, getSavedRate } from '../hooks/usePOS';
import CheckoutModal from '../components/sales/CheckoutModal';
import { formatDate, formatCOP, formatUSD, formatDateShort, formatByCurrency } from '../utils/formatUtils';
import { localToday, localMonthStart } from '../utils/dateUtils';
import { printSaleTicket, printSaleTicketPortable } from '../components/sales/SaleTicket';
import { downloadCSV } from '../utils/csvUtils';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';
import SaleReturnModal from '../components/sales/SaleReturnModal';
import SaleViewSheet from '../components/sales/SaleViewSheet';
import {
  Alert, Badge, Button, Card, Input, Modal,
  Pagination, SearchInput, Select, Table, Textarea, useTableLimit,
  ViewAction, PaymentAction, ReturnAction, CancelAction,
} from '../components/ui';
import type { BadgeVariant, Column } from '../components/ui';
import type { Sale, SalePayment, Customer, PaymentLine, ExchangeRate } from '../types';

// ── Local Interfaces ──────────────────────────────────────────────────────────
interface SaleRow {
  id: number;
  sale_number: string;
  sale_date: string;
  sale_type: 'cash' | 'credit' | 'mixed' | 'pos_pending';
  status: 'pending' | 'completed' | 'cancelled' | 'returned';
  total: number | string;
  subtotal?: number | string;
  discount_amount?: number | string;
  tax_amount?: number | string;
  exchange_rate: number | string;
  paid_amount?: number | string;
  cn_count?: number | string;
  cn_total_cop?: number | string;
  currency_mode?: string;
  customer?: Customer | null;
  [key: string]: unknown;
}

interface SaleDetail extends Sale {
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  paid_amount?: number;
  currency_mode?: string;
  customer?: Customer | null;
  payments?: SalePayment[];
}

interface RefundLine {
  payment_method: string;
  amount: number;
  currency: string;
}

// ── Status / type config ──────────────────────────────────────────────────────
const SALE_TYPE_VARIANT: Record<string, BadgeVariant> = { cash: 'info', credit: 'purple', mixed: 'warning', pos_pending: 'neutral' };
const SALE_TYPE_LABEL: Record<string, string> = { cash: 'Contado', credit: 'Crédito', mixed: 'Mixta', pos_pending: 'Pendiente de Cobro' };

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: 'warning', completed: 'success', cancelled: 'error', returned: 'neutral',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', completed: 'Completada', cancelled: 'Cancelada', returned: 'Devuelta',
};

// Status badge with credit-note dev logic
const StatusBadge = ({ status, cnCount, saleTotal, cnTotalCOP }: { status: string; cnCount: number | string; saleTotal: number | string; cnTotalCOP: number | string; }) => {
  const cnQty   = parseInt(String(cnCount || 0));
  const saleNet = parseFloat(String(saleTotal || 0)) - parseFloat(String(cnTotalCOP || 0));
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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta',
  usdt: 'USDT', credit_balance: 'Monedero',
};

const SalesPage = () => {
  const { companySettings } = useCompany();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [limit, setLimit] = useTableLimit();

  // ─── Filters ──────────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [selectedSale, setSelectedSale]   = useState<SaleDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [paymentSale, setPaymentSale]     = useState<SaleDetail | null>(null);
  const [returnSale, setReturnSale]       = useState<SaleDetail | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [cancelSaleId, setCancelSaleId]   = useState<number | null>(null);
  const [cancelReason, setCancelReason]   = useState('');
  const [refundLines, setRefundLines]     = useState<RefundLine[] | null>(null);

  // Checkout state for pos_pending collection
  const [checkoutPaymentLines, setCheckoutPaymentLines] = useState<PaymentLineUtil[]>([]);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [collectSaving, setCollectSaving] = useState(false);

  // ─── Sort (server-side) ───────────────────────────────────────────────────────
  const { sortBy: salesSortBy, sortDir: salesSortDir, onSort: _salesOnSort } = useTableSort([], { serverSide: true, defaultField: 'sale_date', defaultDir: 'desc' });
  const salesOnSort = (f: string, d: 'asc' | 'desc') => { _salesOnSort(f, d); setCurrentPage(1); };

  // Stats period: dashboard.view → date picker (default: current month), otherwise → today only
  const canSeeDashboard = hasPermission('dashboard.view');
  const today = localToday();
  const monthStart = localMonthStart();
  const [statsFrom, setStatsFrom] = useState(canSeeDashboard ? monthStart : today);
  const [statsTo, setStatsTo]     = useState(today);
  const dateRange = canSeeDashboard
    ? { date_from: statsFrom, date_to: statsTo }
    : { date_from: today, date_to: today };
  const statsPeriodLabel = canSeeDashboard
    ? (statsFrom === monthStart && statsTo === today ? 'del Mes' : 'del Período')
    : 'de Hoy';

  // ─── Queries ──────────────────────────────────────────────────────────────────
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales', currentPage, limit, search, statusFilter, saleTypeFilter, salesSortBy, salesSortDir, dateRange.date_from, dateRange.date_to],
    queryFn: () => saleService.getSales({
      page: currentPage, limit,
      search,
      status: statusFilter || undefined,
      sale_type: saleTypeFilter || undefined,
      ...dateRange,
    }),
    staleTime: 30_000,
  });
  const sales: SaleRow[]      = salesData?.data || [];
  const totalPages = salesData?.pagination?.totalPages || 1;
  const total      = salesData?.pagination?.total || 0;

  const { data: statsData } = useQuery({
    queryKey: ['sales-stats', statusFilter, saleTypeFilter, dateRange.date_from, dateRange.date_to],
    queryFn: () => saleService.getSalesStats({
      status: statusFilter ?? '',
      sale_type: saleTypeFilter ?? '',
      ...dateRange,
    }),
    staleTime: 30_000,
  });
  const stats = statsData?.data || null;

  // Pending POS sales count (for badge)
  const { data: pendingPosCount = 0 } = useQuery({
    queryKey: ['pending-pos-count'],
    queryFn: async () => {
      const res = await saleService.getSales({ sale_type: 'pos_pending', status: 'pending', limit: 1 });
      return res?.pagination?.total || 0;
    },
    refetchInterval: 30_000,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => exchangeRateService.getLatest(),
    staleTime: 5 * 60_000,
  });
  const exchangeRates: ExchangeRate[] = ratesData?.data || [];
  const copPerUSD = calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const invalidateSales = () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['sales-stats'] });
  };

  const cancelMutation = useMutation({
    mutationFn: (vars: { id: number; reason: string }) => saleService.cancelSale(vars.id, vars.reason),
    onSuccess: (res: any) => {
      setCancelSaleId(null);
      setCancelReason('');
      invalidateSales();
      const lines: RefundLine[] = res?.refund_lines || [];
      const cashLines = lines.filter((l: RefundLine) => l.payment_method === 'cash' && l.amount > 0);
      if (cashLines.length > 0) {
        setRefundLines(cashLines);
      } else {
        toast.success('Venta cancelada exitosamente');
      }
    },
    onError: (err: unknown) => {
      const error = err as any;
      toast.error(error?.response?.data?.message || 'Error al cancelar la venta');
    },
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const copFormat = (usdAmount: number | string, saleRate: number | string | null = null) => {
    const val  = parseFloat(String(usdAmount || 0));
    const rate = saleRate
      ? parseFloat(String(saleRate))
      : (calculateEffectiveRate('USD', 'COP', exchangeRates) || 1);
    return formatCOP(val * rate);
  };

  const fmtSaleAmount = (usdAmount: number | string, row: SaleRow) => {
    const val = parseFloat(String(usdAmount || 0));
    if (row.currency_mode === 'USD') return formatUSD(val);
    const rate = parseFloat(String(row.exchange_rate || 1));
    return formatCOP(val * rate);
  };

  const getCustomerName = (customer: any) => {
    if (!customer) return 'Cliente General';
    const words2 = (s: string | undefined) => (s || '').trim().split(/\s+/).slice(0, 2).join(' ');
    const fn = customer.firstName || customer.first_name;
    const ln = customer.lastName || customer.last_name;
    const bn = customer.businessName || customer.business_name;
    const tn = customer.tradeName || customer.trade_name;
    if (customer.type === 'juridical' || customer.type === 'juridica')
      return bn || tn || 'Empresa Sin Nombre';
    return `${words2(fn)} ${words2(ln)}`.trim() || bn || 'Cliente Sin Nombre';
  };

  const renderTotal = (row: SaleRow) => {
    const saleTotal  = parseFloat(String(row.total)) || (parseFloat(String(row.subtotal || 0)) - parseFloat(String(row.discount_amount || 0)));
    const cnCount    = parseInt(String(row.cn_count || 0));
    const cnTotalCOP = parseFloat(String(row.cn_total_cop || 0));
    const rate       = parseFloat(String(row.exchange_rate || 1));
    const netCOP     = Math.round(saleTotal * rate - cnTotalCOP);

    // pos_pending: show full total as pending
    if (row.sale_type === 'pos_pending' && row.status === 'pending') {
      return (
        <div>
          <span className="text-sm font-bold text-orange-600">{fmtSaleAmount(saleTotal, row)}</span>
          <div className="text-[10px] text-gray-400">por cobrar</div>
        </div>
      );
    }

    if ((row.sale_type === 'credit' || row.sale_type === 'mixed') && row.status !== 'cancelled') {
      const pending = saleTotal - parseFloat(String(row.paid_amount || 0));
      if (pending > 0.01) {
        return (
          <div>
            <span className="text-sm font-bold text-red-600">{fmtSaleAmount(pending, row)}</span>
            {parseFloat(String(row.paid_amount || 0)) > 0 && (
              <div className="text-[10px] text-gray-400">de {fmtSaleAmount(saleTotal, row)}</div>
            )}
            {cnCount > 0 && (
              <div className="text-[10px] text-primary-500">
                Dev: -{formatCOP(cnTotalCOP)}
              </div>
            )}
          </div>
        );
      }
    }
    return (
      <div>
        <span className="text-sm font-bold text-gray-900">{fmtSaleAmount(saleTotal, row)}</span>
        {cnCount > 0 && (
          <div className="text-[10px] text-primary-500">
            Neto: {formatCOP(netCOP)} ({cnCount} dev.)
          </div>
        )}
      </div>
    );
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleSearchChange = (v: string) => { setSearch(v);            setCurrentPage(1); };
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setStatusFilter(e.target.value); setCurrentPage(1); };
  const handleTypeChange   = (e: React.ChangeEvent<HTMLSelectElement>) => { setSaleTypeFilter(e.target.value); setCurrentPage(1); };
  const handleClear = () => {
    setSearch(''); setStatusFilter(''); setSaleTypeFilter(''); setCurrentPage(1);
  };

  const [exportingCSV, setExportingCSV] = useState(false);
  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const allSales: SaleRow[] = [];
      let page = 1, hasMore = true;
      const params: Record<string, unknown> = {
        search: search || undefined,
        status: statusFilter || undefined,
        sale_type: saleTypeFilter || undefined,
        sort_by: salesSortBy, sort_dir: salesSortDir,
        ...dateRange,
      };
      while (hasMore) {
        const res = await saleService.getSales({ ...params, page, limit: 200 } as any);
        allSales.push(...(res.data || []));
        const pag = res.pagination || {};
        hasMore = pag.page < pag.totalPages;
        page++;
      }
      const getCustomerLabel = (c: Customer | null | undefined) => {
        if (!c) return 'Cliente General';
        if (c.type === 'juridica') return (c.businessName as string) || (c.tradeName as string) || '';
        return `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Cliente General';
      };
      downloadCSV(
        `ventas_${new Date().toISOString().split('T')[0]}`,
        ['Número', 'Fecha', 'Cliente', 'Tipo', 'Estado', 'Total USD', 'Tasa', 'Total COP'],
        allSales.map((s: SaleRow) => {
          const t = parseFloat(String(s.total)) || 0;
          const r = parseFloat(String(s.exchange_rate)) || 1;
          return [
            s.sale_number,
            s.sale_date ? formatDateShort(s.sale_date) : '',
            getCustomerLabel(s.customer),
            SALE_TYPE_LABEL[s.sale_type] || s.sale_type,
            STATUS_LABEL[s.status] || s.status,
            t.toFixed(2),
            r,
            Math.round(t * r),
          ];
        })
      );
      toast.success(`${allSales.length} ventas exportadas`);
    } catch {
      toast.error('Error al exportar ventas');
    } finally {
      setExportingCSV(false);
    }
  };

  const handleViewDetail = async (saleId: number) => {
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

  const handleCancelSale = (saleId: number) => {
    setCancelSaleId(saleId);
    setCancelReason('');
  };

  const handleOpenPaymentModal = async (sale: SaleDetail) => {
    setCheckoutPaymentLines([]);
    setCheckoutNotes('');
    setPaymentSale(sale);
  };

  const handleCollectPayment = async () => {
    if (checkoutPaymentLines.length === 0) {
      return toast.error('Agrega al menos una forma de pago');
    }
    const sale = paymentSale;
    if (!sale) return;
    const rate = parseFloat(String(sale.exchange_rate)) || copPerUSD;
    const remainingUSD = parseFloat(String(sale.total)) - parseFloat(String(sale.paid_amount || 0));
    // Math.round: elimina ruido float (evita totales tipo 15001 y descuadres de vuelto)
    const saleTotalCOP = Math.round(remainingUSD * rate);

    setCollectSaving(true);
    try {
      const { adjustedLines } = adjustPaymentLinesForChange(
        checkoutPaymentLines, saleTotalCOP, rate, sale.currency_mode || 'COP', COP_TOLERANCE,
        // En modo USD el vuelto se entrega a la tasa editable del modal
        (sale.currency_mode || 'COP') === 'USD' ? (getSavedRate('changeRate', 'COP') || rate) : rate
      );
      const backendLines = convertPaymentLinesToBackend(adjustedLines, exchangeRates, rate);

      await saleService.addPayment(sale.id, {
        payment_lines: backendLines,
        notes: checkoutNotes || undefined,
      } as any);

      toast.success('Cobro registrado exitosamente');
      setPaymentSale(null);
      invalidateSales();
      queryClient.invalidateQueries({ queryKey: ['pending-pos-count'] });

      // Print ticket
      try {
        const saleDetail = await saleService.getSaleById(sale.id);
        setSelectedSale(saleDetail.data);
        printSaleTicket(saleDetail.data, companySettings, {
          displayCurrency: sale.currency_mode || 'COP',
          exchangeRate: rate,
        });
      } catch (_) {}
    } catch (err: unknown) {
      const error = err as any;
      toast.error(error?.response?.data?.message || 'Error al registrar el cobro');
    } finally {
      setCollectSaving(false);
    }
  };

  const handleOpenReturnModal = async (saleId: number) => {
    try {
      const data = await saleService.getSaleById(saleId);
      setReturnSale(data.data);
      setShowReturnModal(true);
    } catch {
      toast.error('Error al cargar el detalle de la venta para devolución');
    }
  };

  const handlePrintTicket = () => {
    if (selectedSale) {
      printSaleTicket(selectedSale as any, companySettings, {
        displayCurrency: 'COP',
        exchangeRate: Number(selectedSale.exchange_rate) || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1,
      });
    }
  };

  const handlePrintTicketPortable = () => {
    if (selectedSale) {
      printSaleTicketPortable(selectedSale as any, companySettings, {
        displayCurrency: 'COP',
        exchangeRate: Number(selectedSale.exchange_rate) || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1,
      });
    }
  };

  // ─── Table columns ────────────────────────────────────────────────────────────
  const columns: Column<SaleRow>[] = [
    {
      key: 'sale_number',
      header: 'Número',
      sortable: true,
      sortKey: 'sale_number',
      render: (v: unknown) => <span className="text-sm font-medium text-gray-900">{String(v ?? '')}</span>,
    },
    {
      key: 'sale_date',
      header: 'Fecha',
      sortable: true,
      sortKey: 'sale_date',
      render: (v: unknown) => (
        <span className="text-sm text-gray-600">
          {formatDate(String(v ?? ''))}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_v: unknown, row: SaleRow) => (
        <span className="text-sm text-gray-900 font-medium block truncate max-w-[200px]" title={getCustomerName(row.customer)}>
          {getCustomerName(row.customer)}
        </span>
      ),
    },
    {
      key: 'sale_type',
      header: 'Tipo',
      render: (v: unknown) => <Badge variant={SALE_TYPE_VARIANT[String(v)] || 'neutral'}>{SALE_TYPE_LABEL[String(v)] || String(v)}</Badge>,
    },
    {
      key: 'total',
      header: 'Total / Pendiente',
      sortable: true,
      sortKey: 'total',
      render: (_v: unknown, row: SaleRow) => renderTotal(row),
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      sortKey: 'status',
      render: (_v: unknown, row: SaleRow) => (
        <StatusBadge
          status={row.status}
          cnCount={row.cn_count || 0}
          saleTotal={parseFloat(String(row.total || 0)) * parseFloat(String(row.exchange_rate || 1))}
          cnTotalCOP={row.cn_total_cop || 0}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_v: unknown, row: SaleRow) => (
        <div className="flex items-center gap-1">
          <ViewAction onClick={() => handleViewDetail(row.id)} />
          {(row.sale_type === 'credit' || row.sale_type === 'mixed' || row.sale_type === 'pos_pending') && row.status === 'pending' && hasPermission('sales.collect') && hasPermission('payments.receive') && (
            <PaymentAction onClick={() => handleOpenPaymentModal(row as unknown as SaleDetail)} title={row.sale_type === 'pos_pending' ? 'Cobrar' : 'Abonar Pago'} />
          )}
          {row.status === 'completed' && hasPermission('credit_notes.create') && (
            <ReturnAction onClick={() => handleOpenReturnModal(row.id)} />
          )}
          {row.status !== 'cancelled' && row.status !== 'returned' && hasPermission('sales.cancel') && (
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Ventas</h1>
          <p className="text-gray-500 mt-1">Administra y consulta todas las ventas realizadas</p>
        </div>
        {pendingPosCount > 0 && (
          <Button
            variant="secondary"
            onClick={() => { setSaleTypeFilter('pos_pending'); setStatusFilter('pending'); setCurrentPage(1); }}
          >
            <ShoppingBag className="w-4 h-4" />
            {pendingPosCount} pendiente{pendingPosCount !== 1 ? 's' : ''} de cobro
          </Button>
        )}
      </div>

      {/* Stats date range picker */}
      {canSeeDashboard && (
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={statsFrom}
            onChange={(e) => { setStatsFrom(e.target.value); setCurrentPage(1); }}
            className="w-auto"
          />
          <span className="text-sm text-gray-500">a</span>
          <Input
            type="date"
            value={statsTo}
            onChange={(e) => { setStatsTo(e.target.value); setCurrentPage(1); }}
            className="w-auto"
          />
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ventas {statsPeriodLabel}</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalSales || 0}</p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </Card>
          <Card variant="compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ingresos {statsPeriodLabel}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.totalRevenueCOP != null
                    ? formatCOP(stats.totalRevenueCOP)
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
                <p className="text-sm text-gray-600 mb-1">Contado {statsPeriodLabel}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.salesByType?.find((s: any) => s.sale_type === 'cash')?.count || 0}
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
                <p className="text-sm text-gray-600 mb-1">Crédito {statsPeriodLabel}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.salesByType?.find((s: any) => s.sale_type === 'credit')?.count || 0}
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
              <option value="pos_pending">Pendiente de Cobro</option>
            </Select>
          </div>
          <Button variant="secondary" onClick={handleClear}>Limpiar</Button>
          {sales.length > 0 && (
            <Button variant="secondary" size="icon" loading={exportingCSV} onClick={handleExportCSV} title="Exportar CSV">
              <FileCsv className="w-4 h-4 text-emerald-600" />
            </Button>
          )}
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
          onLimitChange={(l: number) => { setLimit(l); setCurrentPage(1); }}
        />
      </Card>

      {/* ── Detail sheet ──────────────────────────────────────────────────────── */}
      <SaleViewSheet
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        sale={selectedSale as any}
        onPrint={handlePrintTicket}
        onPrintPortable={handlePrintTicketPortable}
        exchangeRates={exchangeRates as any}
        calculateEffectiveRate={calculateEffectiveRate as any}
      />

      {/* ── CheckoutModal for payment collection (pos_pending, credit, mixed) ── */}
      {paymentSale && (
        <CheckoutModal
          show={!!paymentSale}
          onClose={() => !collectSaving && setPaymentSale(null)}
          subtotal={parseFloat(String(paymentSale.total)) - parseFloat(String(paymentSale.paid_amount || 0))}
          discount={0}
          tax={0}
          total={parseFloat(String(paymentSale.total)) - parseFloat(String(paymentSale.paid_amount || 0))}
          totalCOP={Math.round((parseFloat(String(paymentSale.total)) - parseFloat(String(paymentSale.paid_amount || 0))) * (parseFloat(String(paymentSale.exchange_rate)) || copPerUSD))}
          copPerUSD={parseFloat(String(paymentSale.exchange_rate)) || copPerUSD}
          paymentLines={checkoutPaymentLines}
          setPaymentLines={setCheckoutPaymentLines as React.Dispatch<React.SetStateAction<PaymentLine[]>>}
          customer={paymentSale.customer ? {
            id: paymentSale.customer.id,
            type: paymentSale.customer.type,
            firstName: paymentSale.customer.firstName,
            lastName: paymentSale.customer.lastName,
            businessName: paymentSale.customer.businessName,
            tradeName: paymentSale.customer.tradeName,
          } : null}
          onCustomerSelect={null}
          saleType={paymentSale.sale_type === 'pos_pending' ? 'cash' : paymentSale.sale_type}
          notes={checkoutNotes}
          setNotes={setCheckoutNotes}
          exchangeRates={exchangeRates}
          displayCurrency={paymentSale.currency_mode || 'COP'}
          onComplete={handleCollectPayment}
          saving={collectSaving}
          isAdmin={false}
          mode="collect"
          allowCredit={false}
          title={paymentSale.sale_type === 'pos_pending'
            ? `Cobrar Venta — ${paymentSale.sale_number}`
            : `Abonar Pago — ${paymentSale.sale_number}`}
          confirmLabel={paymentSale.sale_type === 'pos_pending' ? 'Cobrar' : 'Registrar Abono'}
        />
      )}

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
              onClick={() => cancelMutation.mutate({ id: cancelSaleId!, reason: cancelReason.trim() })}
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
            {(refundLines || []).map((line: RefundLine, i: number) => (
              <div key={i} className="flex justify-between items-center px-4 py-3 bg-white">
                <span className="text-sm text-gray-600">
                  {line.currency === 'COP' ? 'Efectivo COP' :
                   line.currency === 'USD' ? 'Efectivo USD' :
                   `Efectivo ${line.currency}`}
                </span>
                <span className="font-bold text-lg text-gray-900">
                  {formatByCurrency(line.amount, line.currency)}
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
        sale={returnSale as any}
        onReturnSuccess={() => {
          setShowReturnModal(false);
          invalidateSales();
        }}
      />
    </div>
  );
};

export default SalesPage;
