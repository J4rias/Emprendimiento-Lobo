import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Download, BookOpen, Search, X, Shield, Eye, EyeOff, CheckCircle, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { arService } from '../services/api/arService';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';

// ─── Constantes ───────────────────────────────────────────────────────────────

const BUCKETS = [
  { key: 'all',        label: 'Todos',       color: 'gray' },
  { key: 'vigente',    label: 'Vigente',     color: 'green' },
  { key: '0_30',       label: '0-30 días',   color: 'yellow' },
  { key: '31_60',      label: '31-60 días',  color: 'orange' },
  { key: '61_90',      label: '61-90 días',  color: 'red' },
  { key: '+90',        label: '+90 días',    color: 'rose' },
  { key: 'sin_termino',label: 'Sin término', color: 'slate' },
];

const BUCKET_COLORS = {
  vigente:    { bg: 'bg-green-500',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
  '0_30':     { bg: 'bg-yellow-400', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  '31_60':    { bg: 'bg-orange-500', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  '61_90':    { bg: 'bg-red-500',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
  '+90':      { bg: 'bg-rose-700',   text: 'text-rose-800',   badge: 'bg-rose-100 text-rose-800' },
  sin_termino:{ bg: 'bg-slate-400',  text: 'text-slate-600',  badge: 'bg-slate-100 text-slate-600' },
};

// ─── Formateo ─────────────────────────────────────────────────────────────────

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Barra de Aging ──────────────────────────────────────────────────────────

function AgingBar({ distribution, total }) {
  if (!distribution?.length || !total) return null;
  const buckets = distribution;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Distribución de Cartera</h3>
        <span className="text-sm text-gray-500">Total pendiente: <strong className="text-gray-800">{fmt(total)}</strong></span>
      </div>
      {/* Barra segmentada */}
      <div className="flex h-8 rounded-lg overflow-hidden mb-3">
        {buckets.map(b => {
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
      {/* Leyenda */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {buckets.map(b => {
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

// ─── Skeleton ────────────────────────────────────────────────────────────────

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

// ─── Modal PIN de configuración ──────────────────────────────────────────────

function PinSetupModal({ onClose }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-1">Configurar PIN de Crédito</h3>
        <p className="text-sm text-gray-500 mb-5">Este PIN se usará para autorizar reversiones de abonos.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo PIN (4-6 dígitos)</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 tracking-widest text-lg"
                placeholder="••••"
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab General ─────────────────────────────────────────────────────────────

function TabGeneral({ data, loading, activeBucket, setActiveBucket, search, setSearch, onExport, currentPage, setCurrentPage, itemsPerPage }) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState('pending_cop');
  const [sortDir, setSortDir] = useState('desc');

  const invoices = data?.invoices || [];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedInvoices = [...invoices].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return sortDir === 'asc' ? result : -result;
  });

  const totalPages = sortedInvoices.length > 0 ? Math.ceil(sortedInvoices.length / itemsPerPage) : 1;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = sortedInvoices.slice(startIdx, startIdx + itemsPerPage);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <div className="w-4 h-4" />;
    return sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {BUCKETS.map(b => (
            <button
              key={b.key}
              onClick={() => setActiveBucket(b.key)}
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
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            placeholder="Buscar cliente o factura..."
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('sale_date')}>
                  <div className="flex items-center gap-2">Fecha <SortIcon field="sale_date" /></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('sale_number')}>
                  <div className="flex items-center gap-2">Factura <SortIcon field="sale_number" /></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('customer_name')}>
                  <div className="flex items-center gap-2">Cliente <SortIcon field="customer_name" /></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('total_cop')}>
                  <div className="flex items-center gap-2">Total COP <SortIcon field="total_cop" /></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('paid_cop')}>
                  <div className="flex items-center gap-2">Pagado <SortIcon field="paid_cop" /></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('pending_cop')}>
                  <div className="flex items-center gap-2">Pendiente <SortIcon field="pending_cop" /></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('due_date')}>
                  <div className="flex items-center gap-2">Vencimiento <SortIcon field="due_date" /></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('aging_bucket')}>
                  <div className="flex items-center gap-2">Estado <SortIcon field="aging_bucket" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="w-12 h-12 text-green-400" />
                      <p className="text-lg font-semibold text-green-700">¡Todo al día!</p>
                      <p className="text-sm text-gray-500">No hay facturas pendientes con los filtros actuales.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map(inv => {
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
      </div>

      {/* Paginación */}
      {sortedInvoices.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {startIdx + 1} a {Math.min(startIdx + itemsPerPage, sortedInvoices.length)} de {sortedInvoices.length} resultados
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-teal-600 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Por Cliente ──────────────────────────────────────────────────────────

function TabClientes({ data, loading, activeBucket, setActiveBucket, search, setSearch, onExport, currentPage, setCurrentPage, itemsPerPage }) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState('total_adeudado_cop');
  const [sortDir, setSortDir] = useState('desc');

  const customers = data?.customers || [];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedCustomers = [...customers].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return sortDir === 'asc' ? result : -result;
  });

  const totalPages = sortedCustomers.length > 0 ? Math.ceil(sortedCustomers.length / itemsPerPage) : 1;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = sortedCustomers.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {BUCKETS.map(b => (
            <button
              key={b.key}
              onClick={() => setActiveBucket(b.key)}
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
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            placeholder="Buscar cliente..."
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {/* Grid de cards */}
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
            {['Total adeudado', 'Vencido', 'Nombre'].map(label => {
              const field = label === 'Total adeudado' ? 'total_adeudado_cop' : label === 'Vencido' ? 'overdue_cop' : 'customer_name';
              const isActive = sortField === field;
              return (
                <button
                  key={field}
                  onClick={() => handleSort(field)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-teal-100 text-teal-700 border border-teal-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-150'
                  }`}
                >
                  {label}
                  {isActive && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedCustomers.map(c => {
            const worstColors = BUCKET_COLORS[c.worst_bucket] || BUCKET_COLORS.sin_termino;
            const agingTotal = Object.values(c.aging || {}).reduce((s, v) => s + v, 0);
            return (
              <div
                key={c.customer_id}
                onClick={() => navigate(`/cuentas-por-cobrar/cliente/${c.customer_id}`)}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-teal-300 transition-all"
              >
                {/* Header de card */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{c.customer_name}</p>
                    <p className="text-xs text-gray-500">{c.customer_code} · {c.pending_invoices} factura{c.pending_invoices !== 1 ? 's' : ''} pendiente{c.pending_invoices !== 1 ? 's' : ''}</p>
                  </div>
                  {c.blocked ? (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">BLOQUEADO</span>
                  ) : (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${worstColors.badge}`}>{BUCKETS.find(b => b.key === c.worst_bucket)?.label || 'Vigente'}</span>
                  )}
                </div>

                {/* Mini barra de aging */}
                {agingTotal > 0 && (
                  <div className="flex h-2 rounded-full overflow-hidden mb-3">
                    {Object.entries(c.aging || {}).filter(([, v]) => v > 0).map(([bucket, amount]) => {
                      const pct = Math.round((amount / agingTotal) * 100);
                      return <div key={bucket} className={`${BUCKET_COLORS[bucket]?.bg || 'bg-gray-300'}`} style={{ width: `${pct}%` }} title={`${bucket}: ${fmt(amount)}`} />;
                    })}
                  </div>
                )}

                {/* Datos principales */}
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

          {/* Paginación */}
          {sortedCustomers.length > itemsPerPage && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Mostrando {startIdx + 1} a {Math.min(startIdx + itemsPerPage, sortedCustomers.length)} de {sortedCustomers.length} resultados
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-teal-600 text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AccountsReceivablePage() {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.pathname.endsWith('/clientes') ? 'clientes' : 'general'
  );
  const [activeBucket, setActiveBucket] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const debouncedSearch = useDebounce(search, 350);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const params = {};
      if (activeBucket !== 'all') params.bucket = activeBucket;
      if (debouncedSearch) params.search = debouncedSearch;

      if (activeTab === 'general') {
        const res = await arService.getSummary(params);
        setSummaryData(res.data);
      } else {
        const res = await arService.getCustomers(params);
        setCustomersData(res.data);
      }
    } catch {
      toast.error('Error al cargar datos de cartera');
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeBucket, debouncedSearch]);

  // Detectar cambios de ruta y actualizar tab
  useEffect(() => {
    setActiveTab(location.pathname.endsWith('/clientes') ? 'clientes' : 'general');
  }, [location.pathname]);

  // Fetch data cuando cambian los filtros
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset filtros al cambiar tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActiveBucket('all');
    setSearch('');
  };

  const distribution = summaryData?.aging_distribution || [];
  const totalPending = activeTab === 'general'
    ? (summaryData?.totals?.total_pending_cop || 0)
    : (customersData?.totals?.total_pending_cop || 0);

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-teal-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuentas por Cobrar</h1>
            <p className="text-sm text-gray-500">
              {activeTab === 'general' ? 'Vista consolidada de todas las facturas pendientes' : 'Análisis detallado por cliente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('ar.view') && (
            <button
              onClick={() => setShowPinSetup(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Configurar PIN
            </button>
          )}
          <button
            onClick={() => activeTab === 'general' ? arService.exportInvoicesCSV({ bucket: activeBucket !== 'all' ? activeBucket : undefined, search: debouncedSearch || undefined }) : arService.exportCustomersCSV({ search: debouncedSearch || undefined })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Barra de aging (solo tab general) */}
      {activeTab === 'general' && !loading && distribution.length > 0 && (
        <AgingBar distribution={distribution} total={totalPending} />
      )}

      {/* Contenido */}
      {activeTab === 'general' ? (
        <TabGeneral
          data={summaryData}
          loading={loading}
          activeBucket={activeBucket}
          setActiveBucket={b => { setActiveBucket(b); }}
          search={search}
          setSearch={setSearch}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      ) : (
        <TabClientes
          data={customersData}
          loading={loading}
          activeBucket={activeBucket}
          setActiveBucket={b => { setActiveBucket(b); }}
          search={search}
          setSearch={setSearch}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}

      {/* Modal PIN */}
      {showPinSetup && <PinSetupModal onClose={() => setShowPinSetup(false)} />}
    </div>
  );
}
