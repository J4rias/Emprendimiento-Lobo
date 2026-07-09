import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DownloadSimple, BookOpen, Eye, EyeSlash, CheckCircle, CaretUp, CaretDown, Shield } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { arService } from '../services/api/arService';
import { useAuth } from '../context/AuthContext';
import { Button, Modal, Pagination, SearchInput, useTableLimit } from '../components/ui';

// ─── Constantes ───────────────────────────────────────────────────────────────

const BUCKETS = [
  { key: 'all',         label: 'Todos',       color: 'gray' },
  { key: 'vigente',     label: 'Vigente',     color: 'green' },
  { key: '0_30',        label: '0-30 días',   color: 'yellow' },
  { key: '31_60',       label: '31-60 días',  color: 'orange' },
  { key: '61_90',       label: '61-90 días',  color: 'red' },
  { key: '+90',         label: '+90 días',    color: 'rose' },
  { key: 'sin_termino', label: 'Sin término', color: 'slate' },
];

const BUCKET_COLORS = {
  vigente:     { bg: 'bg-green-500',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
  '0_30':      { bg: 'bg-yellow-400', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  '31_60':     { bg: 'bg-orange-500', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  '61_90':     { bg: 'bg-red-500',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
  '+90':       { bg: 'bg-rose-700',   text: 'text-rose-800',   badge: 'bg-rose-100 text-rose-800' },
  sin_termino: { bg: 'bg-slate-400',  text: 'text-slate-600',  badge: 'bg-slate-100 text-slate-600' },
};

// ─── Formateo ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Barra de Aging ──────────────────────────────────────────────────────────

function AgingBar({ distribution, total }) {
  if (!distribution?.length || !total) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Distribución de Cartera</h3>
        <span className="text-sm text-gray-500">
          Total pendiente: <strong className="text-gray-800">{fmt(total)}</strong>
        </span>
      </div>
      <div className="flex h-8 rounded-lg overflow-hidden mb-3">
        {distribution.map(b => {
          const colors = BUCKET_COLORS[b.bucket];
          if (!b.pct) return null;
          return (
            <div
              key={b.bucket}
              className={`${colors.bg} relative group cursor-default`}
              style={{ width: `${b.pct}%`, minWidth: b.pct > 2 ? undefined : '4px' }}
              title={`${b.label}: ${fmt(b.amount)}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {distribution.map(b => {
          const colors = BUCKET_COLORS[b.bucket];
          if (!b.count) return null;
          return (
            <div key={b.bucket} className="flex items-start gap-2">
              <div className={`w-3 h-3 rounded-sm mt-0.5 flex-shrink-0 ${colors.bg}`} />
              <div>
                <p className="text-xs font-medium text-gray-700">{b.label}</p>
                <p className="text-xs text-gray-500">{fmt(b.amount)}</p>
                <p className="text-xs text-gray-400">{b.count} fact. · {b.pct}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-full" /></td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        <div className="h-5 bg-gray-200 rounded w-16" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-200 rounded w-full" />
    </div>
  );
}

// ─── Bucket filter pills ──────────────────────────────────────────────────────

function BucketFilter({ activeBucket, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {BUCKETS.map(b => (
        <button
          key={b.key}
          onClick={() => onSelect(b.key)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            activeBucket === b.key
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal PIN de configuración ──────────────────────────────────────────────

function PinSetupModal({ open, onClose }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!/^\d{4,6}$/.test(pin)) return toast.error('El PIN debe ser de 4 a 6 dígitos numéricos');
    if (pin !== confirmPin) return toast.error('Los PINs no coinciden');
    setLoading(true);
    try {
      await arService.setAdminPin(pin);
      toast.success('PIN configurado exitosamente');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al guardar el PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Configurar PIN de Crédito" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Este PIN se usará para autorizar reversiones de abonos.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nuevo PIN (4-6 dígitos)
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 tracking-widest text-lg pr-10"
                placeholder="••••"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar PIN</label>
            <input
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 tracking-widest text-lg"
              placeholder="••••"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="success"
            className="flex-1"
            loading={loading}
            onClick={handleSave}
          >
            <CheckCircle className="w-4 h-4" />
            Guardar PIN
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Tab General ─────────────────────────────────────────────────────────────

function TabGeneral({ data, loading, activeBucket, onBucketSelect, search, onSearch, limit, onLimitChange, currentPage, onPageChange }) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState('pending_cop');
  const [sortDir, setSortDir] = useState('desc');

  const invoices = data?.invoices || [];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = [...invoices].sort((a, b) => {
    const r = a[sortField] > b[sortField] ? 1 : a[sortField] < b[sortField] ? -1 : 0;
    return sortDir === 'asc' ? r : -r;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const startIdx = (currentPage - 1) * limit;
  const paginated = sorted.slice(startIdx, startIdx + limit);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="w-4 h-4 inline-block" />;
    return sortDir === 'asc' ? <CaretUp className="w-4 h-4" /> : <CaretDown className="w-4 h-4" />;
  };

  const TH = ({ field, children }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">{children} <SortIcon field={field} /></div>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
        <BucketFilter activeBucket={activeBucket} onSelect={onBucketSelect} />
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Buscar cliente o factura..."
          className="w-64"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <TH field="sale_date">Fecha</TH>
                <TH field="sale_number">Factura</TH>
                <TH field="customer_name">Cliente</TH>
                <TH field="total_cop">Total COP</TH>
                <TH field="paid_cop">Pagado</TH>
                <TH field="pending_cop">Pendiente</TH>
                <TH field="due_date">Vencimiento</TH>
                <TH field="aging_bucket">Estado</TH>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="w-12 h-12 text-green-400" />
                      <p className="text-lg font-semibold text-green-700">¡Todo al día!</p>
                      <p className="text-sm text-gray-500">No hay facturas pendientes con los filtros actuales.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(inv => {
                  const colors = BUCKET_COLORS[inv.aging_bucket] || BUCKET_COLORS.sin_termino;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/cuentas-por-cobrar/cliente/${inv.customer_id}`)}
                      className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtDate(inv.sale_date)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-teal-700 whitespace-nowrap">{inv.sale_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{inv.customer_name}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-800 whitespace-nowrap">{fmt(inv.total_cop)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700 whitespace-nowrap">{fmt(inv.paid_cop)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-orange-700 whitespace-nowrap">{fmt(inv.pending_cop)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
                          {inv.aging_label}
                          {inv.days_overdue > 0 && ` · ${inv.days_overdue}d`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {sorted.length > 0 && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={sorted.length}
            limit={limit}
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tab Por Cliente ──────────────────────────────────────────────────────────

function TabClientes({ data, loading, activeBucket, onBucketSelect, search, onSearch, limit, onLimitChange, currentPage, onPageChange }) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState('total_adeudado_cop');
  const [sortDir, setSortDir] = useState('desc');

  const customers = data?.customers || [];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = [...customers].sort((a, b) => {
    const r = a[sortField] > b[sortField] ? 1 : a[sortField] < b[sortField] ? -1 : 0;
    return sortDir === 'asc' ? r : -r;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const startIdx = (currentPage - 1) * limit;
  const paginated = sorted.slice(startIdx, startIdx + limit);

  const SORT_OPTS = [
    { label: 'Total adeudado', field: 'total_adeudado_cop' },
    { label: 'Vencido',        field: 'overdue_cop' },
    { label: 'Nombre',         field: 'customer_name' },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
        <BucketFilter activeBucket={activeBucket} onSelect={onBucketSelect} />
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Buscar cliente..."
          className="w-64"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20">
          <CheckCircle className="w-14 h-14 text-green-400" />
          <p className="text-lg font-semibold text-green-700">¡Sin deudas pendientes!</p>
          <p className="text-sm text-gray-500">No hay clientes con saldo por cobrar.</p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex gap-2 flex-wrap">
            {SORT_OPTS.map(({ label, field }) => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  sortField === field
                    ? 'bg-teal-100 text-teal-700 border border-teal-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-150'
                }`}
              >
                {label}
                {sortField === field && (
                  sortDir === 'asc' ? <CaretUp className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginated.map(c => {
              const worstColors = BUCKET_COLORS[c.worst_bucket] || BUCKET_COLORS.sin_termino;
              const agingTotal = Object.values(c.aging || {}).reduce((s, v) => s + v, 0);
              return (
                <div
                  key={c.customer_id}
                  onClick={() => navigate(`/cuentas-por-cobrar/cliente/${c.customer_id}`)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-teal-300 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{c.customer_name}</p>
                      <p className="text-xs text-gray-500">
                        {c.customer_code} · {c.pending_invoices} factura{c.pending_invoices !== 1 ? 's' : ''} pendiente{c.pending_invoices !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {c.blocked ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">BLOQUEADO</span>
                    ) : (
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${worstColors.badge}`}>
                        {BUCKETS.find(b => b.key === c.worst_bucket)?.label || 'Vigente'}
                      </span>
                    )}
                  </div>

                  {agingTotal > 0 && (
                    <div className="flex h-2 rounded-full overflow-hidden mb-3">
                      {Object.entries(c.aging || {}).filter(([, v]) => v > 0).map(([bucket, amount]) => {
                        const pct = Math.round((amount / agingTotal) * 100);
                        return (
                          <div
                            key={bucket}
                            className={BUCKET_COLORS[bucket]?.bg || 'bg-gray-300'}
                            style={{ width: `${pct}%` }}
                            title={`${bucket}: ${fmt(amount)}`}
                          />
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <p className="text-xs text-gray-500">Total adeudado</p>
                      <p className="text-sm font-bold text-orange-700">{fmt(c.total_adeudado_cop)}</p>
                    </div>
                    {c.overdue_cop > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Vencido</p>
                        <p className="text-sm font-bold text-red-700">{fmt(c.overdue_cop)}</p>
                      </div>
                    )}
                    {c.last_payment_date && (
                      <div>
                        <p className="text-xs text-gray-500">Último pago</p>
                        <p className="text-sm text-gray-700">{fmtDate(c.last_payment_date)}</p>
                      </div>
                    )}
                  </div>

                  {c.blocked_reason && (
                    <p className="mt-3 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{c.blocked_reason}</p>
                  )}
                </div>
              );
            })}
          </div>

          {sorted.length > limit && (
            <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={sorted.length}
                limit={limit}
                onPageChange={onPageChange}
                onLimitChange={onLimitChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-teal-600 text-teal-700'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}
  >
    {children}
  </button>
);

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AccountsReceivablePage() {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.pathname.endsWith('/clientes') ? 'clientes' : 'general'
  );
  const [activeBucket, setActiveBucket] = useState('all');
  const [search, setSearch] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useTableLimit();

  // Keep tab in sync if URL changes externally
  useEffect(() => {
    setActiveTab(location.pathname.endsWith('/clientes') ? 'clientes' : 'general');
  }, [location.pathname]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeBucket, search, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActiveBucket('all');
    setSearch('');
    setCurrentPage(1);
  };

  // ── Queries ──

  const queryParams = {
    ...(activeBucket !== 'all' && { bucket: activeBucket }),
    ...(search && { search }),
  };

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['ar-summary', activeBucket, search],
    queryFn: () => arService.getSummary(queryParams).then(r => r.data),
    enabled: activeTab === 'general',
    staleTime: 60_000,
  });

  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['ar-customers', activeBucket, search],
    queryFn: () => arService.getCustomers(queryParams).then(r => r.data),
    enabled: activeTab === 'clientes',
    staleTime: 60_000,
  });

  const loading = activeTab === 'general' ? loadingSummary : loadingCustomers;
  const distribution = summaryData?.aging_distribution || [];
  const totalPending = activeTab === 'general'
    ? (summaryData?.totals?.total_pending_cop || 0)
    : (customersData?.totals?.total_pending_cop || 0);

  const handleExport = () => {
    if (activeTab === 'general') {
      arService.exportInvoicesCSV(queryParams);
    } else {
      arService.exportCustomersCSV({ search: search || undefined });
    }
  };

  const sharedProps = {
    activeBucket,
    onBucketSelect: setActiveBucket,
    search,
    onSearch: setSearch,
    limit,
    onLimitChange: (n) => { setLimit(n); setCurrentPage(1); },
    currentPage,
    onPageChange: setCurrentPage,
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-teal-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuentas por Cobrar</h1>
            <p className="text-sm text-gray-500">
              {activeTab === 'general'
                ? 'Vista consolidada de todas las facturas pendientes'
                : 'Análisis detallado por cliente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('admin') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPinSetup(true)}
              title="Configurar PIN de reversión"
            >
              <Shield className="w-4 h-4" />
              PIN
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <DownloadSimple className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex -mb-px">
          <TabBtn active={activeTab === 'general'} onClick={() => handleTabChange('general')}>
            Facturas
          </TabBtn>
          <TabBtn active={activeTab === 'clientes'} onClick={() => handleTabChange('clientes')}>
            Por Cliente
          </TabBtn>
        </nav>
      </div>

      {/* Aging bar (solo tab Facturas) */}
      {activeTab === 'general' && !loading && distribution.length > 0 && (
        <AgingBar distribution={distribution} total={totalPending} />
      )}

      {/* Content */}
      {activeTab === 'general' ? (
        <TabGeneral data={summaryData} loading={loadingSummary} {...sharedProps} />
      ) : (
        <TabClientes data={customersData} loading={loadingCustomers} {...sharedProps} />
      )}

      {/* PIN Setup Modal */}
      <PinSetupModal open={showPinSetup} onClose={() => setShowPinSetup(false)} />
    </div>
  );
}
