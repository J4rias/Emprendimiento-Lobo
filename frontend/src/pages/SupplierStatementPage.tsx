import { Fragment, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Receipt, FileText, Money,
  Building, CreditCard, Tag,
  CaretDown, CaretRight, WarningCircle,
  ArrowDownRight, ArrowUpRight,
  DownloadSimple, CalendarBlank, X,
} from '@phosphor-icons/react';
import { supplierService } from '../services/api/supplierService';
import {
  Alert, Badge, Button, Spinner, Pagination, useTableLimit,
  DateRangeFilter,
} from '../components/ui';
import { downloadCSV } from '../utils/csvUtils';
import { formatUSD, formatCOP, formatVES, formatDateShort, LOCALE } from '../utils/formatUtils';

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  USD: {
    label: 'USD',
    sublabel: 'Se paga en Bolívares',
    tabActive: 'bg-primary-600 text-white',
    tabInactive: 'text-primary-700 hover:bg-primary-50',
    fmtAmount: (v) => formatUSD(v),
  },
  DIVISAS: {
    label: 'USD Digital',
    sublabel: 'Se paga en USD (Zelle, USDT)',
    tabActive: 'bg-emerald-600 text-white',
    tabInactive: 'text-emerald-700 hover:bg-emerald-50',
    fmtAmount: (v) => formatUSD(v),
  },
  COP: {
    label: 'COP',
    sublabel: 'Se paga en Pesos',
    tabActive: 'bg-amber-600 text-white',
    tabInactive: 'text-amber-700 hover:bg-amber-50',
    fmtAmount: (v) => formatCOP(v),
  },
};

const PO_STATUS_LABELS = {
  pending:   'Pendiente',
  partial:   'Recibido Parcial',
  received:  'Recibido',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const PO_STATUS_VARIANTS = {
  pending:   'warning',
  partial:   'info',
  received:  'success',
  completed: 'success',
  cancelled: 'neutral',
};

const PAYMENT_METHODS = {
  cash:           'Efectivo',
  transfer:       'Transferencia',
  check:          'Cheque',
  card:           'Tarjeta',
  usdt:           'USDT',
  credit_balance: 'Saldo a Favor',
  other:          'Otro',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const fmtRate = (v) =>
  (parseFloat(v) || 0).toLocaleString(LOCALE, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryCard = ({ title, value, subtitle, icon: Icon, colorClass }) => (
  <div className={`rounded-xl p-4 border ${colorClass}`}>
    <div className="flex items-center justify-between mb-1.5">
      <p className="text-xs font-medium opacity-75">{title}</p>
      <Icon className="h-4 w-4 opacity-60" />
    </div>
    <p className="text-lg font-bold leading-tight">{value}</p>
    {subtitle && <p className="text-[10px] opacity-60 mt-0.5">{subtitle}</p>}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const SupplierStatementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]     = useState(null);
  const [expandedId, setExpandedId]   = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit]             = useTableLimit();
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: ledgerData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['supplier-ledger', id],
    queryFn: () => supplierService.getLedger(Number(id)).then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: supplierInfo } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => supplierService.getById(Number(id)).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const categories = ledgerData?.categories || {};
  const catKeys    = Object.keys(categories);

  // Pick active tab (prefer USD → DIVISAS → COP; fall back to first available)
  const defaultTab  = ['USD', 'DIVISAS', 'COP'].find((c) => catKeys.includes(c)) || catKeys[0] || null;
  const resolvedTab = activeTab && catKeys.includes(activeTab) ? activeTab : defaultTab;
  const activeCat   = resolvedTab ? categories[resolvedTab] : null;
  const config      = CATEGORY_CONFIG[resolvedTab] || CATEGORY_CONFIG.USD;

  const supplier = ledgerData?.supplier || supplierInfo;
  const bcvRate  = ledgerData?.bcv_rate;

  // ── Merge facturas + pagos en ledger cronológico ───────────────────────────

  const mergedLedger = useMemo(() => {
    if (!activeCat) return [];

    const entries = [
      ...(activeCat.invoices || []).map((inv) => ({
        id:        `inv_${inv.id}`,
        rawId:     inv.id,
        type:      'charge',
        date:      inv.date,
        reference: inv.description,  // OC order_number
        amount:    parseFloat(inv.amount || 0),
        status:    inv.status,
        notes:     inv.notes,
      })),
      ...(activeCat.payments || []).map((pay) => ({
        id:             `pay_${pay.id}`,
        rawId:          pay.id,
        type:           'payment',
        date:           pay.date,
        reference:      pay.description,  // reference || payment_number
        payment_number: pay.payment_number,
        method:         pay.payment_method,
        amount:         parseFloat(pay.amount || 0),
        bcv_rate:       pay.bcv_rate,
        amount_ves:     pay.amount_ves,
      })),
    ];

    // Orden cronológico ASC; en misma fecha, cargo antes que pago
    entries.sort((a, b) => {
      const da = new Date(a.date + 'T12:00:00').getTime();
      const db = new Date(b.date + 'T12:00:00').getTime();
      if (da !== db) return da - db;
      if (a.type === 'charge' && b.type !== 'charge') return -1;
      if (b.type === 'charge' && a.type !== 'charge') return 1;
      return 0;
    });

    // Saldo corriente acumulado
    let running = 0;
    return entries.map((entry) => {
      running = entry.type === 'charge' ? running + entry.amount : running - entry.amount;
      return { ...entry, runningBalance: running };
    });
  }, [activeCat]);

  // ── Filtro por fecha + saldo de apertura ───────────────────────────────────

  const { displayLedger, openingBalance } = useMemo(() => {
    if (!startDate && !endDate) {
      return { displayLedger: mergedLedger, openingBalance: null };
    }

    // Saldo acumulado antes del período
    let opening = 0;
    for (const e of mergedLedger) {
      if (startDate && e.date < startDate) {
        opening = e.type === 'charge' ? opening + e.amount : opening - e.amount;
      }
    }

    // Filtrar entradas dentro del rango
    const filtered = mergedLedger.filter((e) => {
      if (startDate && e.date < startDate) return false;
      if (endDate   && e.date > endDate)   return false;
      return true;
    });

    // Recalcular saldo corriente desde el saldo de apertura
    let running = opening;
    const withBalance = filtered.map((e) => {
      running = e.type === 'charge' ? running + e.amount : running - e.amount;
      return { ...e, runningBalance: running };
    });

    return { displayLedger: withBalance, openingBalance: opening };
  }, [mergedLedger, startDate, endDate]);

  // ── Paginación ─────────────────────────────────────────────────────────────

  const totalPages     = Math.max(1, Math.ceil(displayLedger.length / limit));
  const startIdx       = (currentPage - 1) * limit;
  const paginatedLedger = displayLedger.slice(startIdx, startIdx + limit);

  // ── Totales del período ────────────────────────────────────────────────────

  const periodCharges  = displayLedger.filter((e) => e.type === 'charge').reduce((s, e) => s + e.amount, 0);
  const periodPayments = displayLedger.filter((e) => e.type === 'payment').reduce((s, e) => s + e.amount, 0);
  const finalBalance   = displayLedger.length > 0 ? displayLedger[displayLedger.length - 1].runningBalance : null;

  // ── Export CSV ─────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const currency = resolvedTab || '';
    const headers  = ['Fecha', 'Documento', 'Concepto', 'Método', `Cargo (${currency})`, `Abono (${currency})`, 'Saldo'];
    const rows     = displayLedger.map((e) => [
      fmtDate(e.date),
      e.reference || '—',
      e.type === 'charge' ? 'Orden de Compra' : 'Pago',
      e.type === 'payment' ? (PAYMENT_METHODS[e.method] || e.method || '—') : '—',
      e.type === 'charge'   ? e.amount.toFixed(2) : '',
      e.type === 'payment'  ? e.amount.toFixed(2) : '',
      e.runningBalance.toFixed(2),
    ]);
    const name = (supplier?.name || 'proveedor').replace(/\s+/g, '_').toLowerCase();
    downloadCSV(`estado_cuenta_${name}_${currency.toLowerCase()}`, headers, rows);
  };

  // ── Cambio de pestaña ──────────────────────────────────────────────────────

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setExpandedId(null);
    setCurrentPage(1);
  };

  // ── Render fila ────────────────────────────────────────────────────────────

  const renderRow = (entry) => {
    const isCharge   = entry.type === 'charge';
    const isExpanded = expandedId === entry.id;
    const bal        = entry.runningBalance;
    const isDebt     = bal > 0.01;
    const isCredit   = bal < -0.01;
    const balClass   = isDebt ? 'text-red-600 font-semibold' : isCredit ? 'text-green-600 font-semibold' : 'text-gray-400';

    return (
      <Fragment key={entry.id}>
        <tr
          className={`border-b border-gray-100 cursor-pointer transition-colors ${
            isCharge ? 'hover:bg-orange-50/40' : 'hover:bg-green-50/40'
          }`}
          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
        >
          {/* Expandir */}
          <td className="px-3 py-3 w-8">
            {isExpanded
              ? <CaretDown  className="h-3.5 w-3.5 text-gray-400" />
              : <CaretRight className="h-3.5 w-3.5 text-gray-300" />
            }
          </td>

          {/* Fecha */}
          <td className="px-2 py-3 text-xs text-gray-500 whitespace-nowrap">
            {fmtDate(entry.date)}
          </td>

          {/* Documento */}
          <td className="px-2 py-3">
            <div className="flex items-center gap-2">
              {isCharge
                ? <FileText className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                : <Money    className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              }
              <div>
                <p className="text-xs font-medium text-gray-800">{entry.reference || '—'}</p>
                <p className="text-[10px] text-gray-400">{isCharge ? 'Orden de Compra' : 'Pago'}</p>
              </div>
            </div>
          </td>

          {/* Método pago (solo pagos, oculto en mobile) */}
          <td className="px-2 py-3 hidden md:table-cell">
            {!isCharge && entry.method && (
              <Badge variant="neutral">
                {PAYMENT_METHODS[entry.method] || entry.method}
              </Badge>
            )}
          </td>

          {/* Cargo */}
          <td className="px-2 py-3 text-right text-xs">
            {isCharge && (
              <span className="text-orange-700 font-medium">{config.fmtAmount(entry.amount)}</span>
            )}
          </td>

          {/* Abono */}
          <td className="px-2 py-3 text-right text-xs">
            {!isCharge && (
              <span className="text-green-700 font-medium">{config.fmtAmount(entry.amount)}</span>
            )}
          </td>

          {/* Saldo corriente */}
          <td className={`px-3 py-3 text-right text-xs ${balClass}`}>
            {config.fmtAmount(Math.abs(bal))}
            {isCredit && <span className="ml-0.5 text-[9px] opacity-70"> a favor</span>}
          </td>
        </tr>

        {/* Detalle expandido */}
        {isExpanded && (
          <tr className="bg-gray-50">
            <td colSpan={7} className="px-6 py-3 border-b border-gray-100">
              {isCharge ? (
                <div className="flex flex-wrap gap-5 text-xs text-gray-600">
                  {entry.status && (
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Estado OC</span>
                      <Badge variant={PO_STATUS_VARIANTS[entry.status] || 'neutral'}>
                        {PO_STATUS_LABELS[entry.status] || entry.status}
                      </Badge>
                    </div>
                  )}
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Monto</span>
                    <span className="text-orange-700 font-bold">{config.fmtAmount(entry.amount)}</span>
                  </div>
                  {entry.notes && (
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Notas</span>
                      <span className="text-gray-700">{entry.notes}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-5 text-xs text-gray-600">
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">N° Pago</span>
                    <span className="text-gray-800 font-medium">{entry.payment_number || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Método</span>
                    <span className="text-gray-800">{PAYMENT_METHODS[entry.method] || entry.method || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Monto</span>
                    <span className="text-green-700 font-bold">{config.fmtAmount(entry.amount)}</span>
                  </div>
                  {entry.bcv_rate && (
                    <>
                      <div>
                        <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Tasa BCV</span>
                        <span className="text-gray-700">{fmtRate(entry.bcv_rate)}</span>
                      </div>
                      {entry.amount_ves && (
                        <div>
                          <span className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Monto Bs</span>
                          <span className="text-gray-700 font-semibold">{formatVES(entry.amount_ves)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  // ── Loading / error ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Cargando estado de cuenta...</p>
      </div>
    );
  }

  if (isError || !ledgerData) {
    return (
      <div className="p-6 space-y-4">
        <Alert variant="error">
          {error?.response?.data?.message || 'Error al cargar el estado de cuenta'}
        </Alert>
        <Button variant="ghost" size="sm" onClick={() => navigate('/proveedores')}>
          <ArrowLeft className="h-4 w-4" />
          Volver a Proveedores
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/proveedores')}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="h-5 w-px bg-gray-300 mt-1" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Building className="h-5 w-5 text-gray-400 shrink-0" />
              <h1 className="text-xl font-bold text-gray-900">{supplier?.name || '—'}</h1>
              {supplierInfo?.tax_id && (
                <span className="text-sm text-gray-500">· {supplierInfo.tax_id}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5 ml-7">
              Estado de Cuenta
              {supplierInfo?.payment_terms && (
                <span className="ml-2 text-gray-400">· {supplierInfo.payment_terms}</span>
              )}
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/supplier-payments')}
        >
          <CreditCard className="h-4 w-4" />
          Ver Pagos
        </Button>
      </div>

      {/* ── Sin datos ──────────────────────────────────────────────────────── */}
      {catKeys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay operaciones registradas para este proveedor.</p>
          <p className="text-sm text-gray-400 mt-1">Las órdenes de compra y pagos aparecerán aquí.</p>
        </div>
      ) : (
        <>
          {/* ── Tabs de moneda + tarjetas resumen ──────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Tabs */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
              {catKeys.map((cat) => {
                const cfg      = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.USD;
                const isActive = resolvedTab === cat;
                const catData  = categories[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => handleTabChange(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isActive ? cfg.tabActive : cfg.tabInactive
                    }`}
                  >
                    {cfg.label}
                    <span className={`ml-2 text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                      ({cfg.fmtAmount(catData.balance)})
                    </span>
                  </button>
                );
              })}

              {/* Tasa BCV (solo cuando estamos en USD y está disponible) */}
              {bcvRate && resolvedTab === 'USD' && (
                <div className="ml-auto text-xs text-gray-500 shrink-0">
                  BCV: <span className="font-semibold text-gray-700">{fmtRate(bcvRate)}</span>
                </div>
              )}
            </div>

            {/* Tarjetas resumen */}
            {activeCat && (
              <div className={`grid grid-cols-2 gap-4 p-4 ${
                resolvedTab === 'USD' && bcvRate && activeCat.balance > 0.01
                  ? 'lg:grid-cols-4'
                  : 'lg:grid-cols-3'
              }`}>
                <SummaryCard
                  title="Total Facturado"
                  value={config.fmtAmount(activeCat.total_invoiced)}
                  subtitle={`${activeCat.invoices?.length || 0} órdenes de compra`}
                  icon={FileText}
                  colorClass="bg-orange-50 border-orange-200 text-orange-800"
                />
                <SummaryCard
                  title="Total Pagado"
                  value={config.fmtAmount(activeCat.total_paid)}
                  subtitle={`${activeCat.payments?.length || 0} pagos registrados`}
                  icon={Money}
                  colorClass="bg-green-50 border-green-200 text-green-800"
                />
                <SummaryCard
                  title={
                    activeCat.balance > 0.01
                      ? 'Saldo Pendiente'
                      : activeCat.balance < -0.01
                      ? 'Saldo a Favor'
                      : 'Al Día'
                  }
                  value={config.fmtAmount(Math.abs(activeCat.balance))}
                  subtitle={activeCat.balance < -0.01 ? 'A favor del negocio' : undefined}
                  icon={activeCat.balance > 0.01 ? ArrowDownRight : ArrowUpRight}
                  colorClass={
                    activeCat.balance > 0.01
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : activeCat.balance < -0.01
                      ? 'bg-teal-50 border-teal-200 text-teal-800'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }
                />
                {resolvedTab === 'USD' && bcvRate && activeCat.balance > 0.01 && (
                  <SummaryCard
                    title="Equivalente Bs"
                    value={formatVES(activeCat.balance * parseFloat(bcvRate))}
                    subtitle={`Tasa BCV: ${fmtRate(bcvRate)}`}
                    icon={Tag}
                    colorClass="bg-purple-50 border-purple-200 text-purple-800"
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Tabla del ledger ────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Toolbar */}
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="font-semibold text-gray-800">Historial de Movimientos</h2>
                <Badge variant="neutral">{displayLedger.length}</Badge>
                {(startDate || endDate) && (
                  <Badge variant="info">Período filtrado</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters((f) => !f)}
                  className={(showFilters || startDate || endDate) ? 'bg-primary-100 text-primary-700 hover:bg-primary-100' : ''}
                >
                  <CalendarBlank className="h-4 w-4" />
                  Período
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={displayLedger.length === 0}
                >
                  <DownloadSimple className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>

            {/* Panel de filtros */}
            {showFilters && (
              <div className="px-5 py-3 bg-primary-50/60 border-b border-primary-100 flex flex-wrap items-end gap-4">
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onChange={({ start_date, end_date }) => {
                    setStartDate(start_date);
                    setEndDate(end_date);
                    setCurrentPage(1);
                  }}
                  showPresets
                />
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }}
                  >
                    <X className="h-4 w-4" />
                    Limpiar
                  </Button>
                )}
              </div>
            )}

            {/* Tabla */}
            {displayLedger.length === 0 ? (
              <div className="py-16 text-center">
                <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay movimientos en este período.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-3 py-3 w-8" />
                        <th className="px-2 py-3 text-left">Fecha</th>
                        <th className="px-2 py-3 text-left">Documento</th>
                        <th className="px-2 py-3 text-left hidden md:table-cell">Método</th>
                        <th className="px-2 py-3 text-right">Cargo</th>
                        <th className="px-2 py-3 text-right">Abono</th>
                        <th className="px-3 py-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Fila de saldo de apertura cuando hay filtro activo */}
                      {openingBalance !== null && currentPage === 1 && (
                        <tr className="bg-amber-50 border-b border-amber-100">
                          <td className="px-3 py-2.5" />
                          <td
                            colSpan={5}
                            className="px-2 py-2.5 text-xs text-amber-700 font-medium italic"
                          >
                            Saldo de apertura al {fmtDate(startDate)}
                          </td>
                          <td className={`px-3 py-2.5 text-right text-xs font-bold ${
                            openingBalance > 0.01
                              ? 'text-red-700'
                              : openingBalance < -0.01
                              ? 'text-green-700'
                              : 'text-gray-500'
                          }`}>
                            {config.fmtAmount(Math.abs(openingBalance))}
                            {openingBalance < -0.01 && (
                              <span className="ml-0.5 text-[9px] opacity-70"> a favor</span>
                            )}
                          </td>
                        </tr>
                      )}

                      {paginatedLedger.map(renderRow)}
                    </tbody>

                    {/* Totales del período */}
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td
                          colSpan={4}
                          className="px-3 py-3 text-xs font-bold text-gray-500 uppercase"
                        >
                          {startDate || endDate ? 'Totales del período' : 'Totales'}
                        </td>
                        <td className="px-2 py-3 text-right text-xs font-bold text-orange-700">
                          {config.fmtAmount(periodCharges)}
                        </td>
                        <td className="px-2 py-3 text-right text-xs font-bold text-green-700">
                          {config.fmtAmount(periodPayments)}
                        </td>
                        <td className={`px-3 py-3 text-right text-xs font-bold ${
                          finalBalance !== null
                            ? finalBalance > 0.01
                              ? 'text-red-600'
                              : finalBalance < -0.01
                              ? 'text-green-600'
                              : 'text-gray-400'
                            : 'text-gray-400'
                        }`}>
                          {finalBalance !== null
                            ? config.fmtAmount(Math.abs(finalBalance))
                            : '—'
                          }
                          {finalBalance !== null && finalBalance < -0.01 && (
                            <span className="ml-0.5 text-[9px] opacity-70"> a favor</span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  total={displayLedger.length}
                  limit={limit}
                  onPageChange={setCurrentPage}
                  onLimitChange={(n) => { setLimit(n); setCurrentPage(1); }}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierStatementPage;
