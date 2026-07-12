import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CurrencyDollar,
  Money,
  Bank,
  TrendDown,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { supplierService } from '../services/api/supplierService';
import { Alert, Button, Card, SearchInput, Spinner, ViewAction } from '../components/ui';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtUSD = (v) => {
  const val = parseFloat(v) || 0;
  if (Math.abs(val) < 0.01) return '-';
  return `$ ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtCOP = (v) => {
  const val = parseFloat(v) || 0;
  if (Math.abs(val) < 1) return '-';
  return `$ ${Math.ceil(val).toLocaleString('es-VE')}`;
};

const fmtVES = (v) => {
  const val = parseFloat(v) || 0;
  if (Math.abs(val) < 1) return '-';
  return `Bs ${Math.ceil(val).toLocaleString('es-VE')}`;
};

// ── Row ───────────────────────────────────────────────────────────────────────
const SupplierRow = ({ supplier, bcvRate, onView }) => {
  const { balances } = supplier;
  const vesEquiv = bcvRate ? (balances.USD || 0) * parseFloat(bcvRate) : 0;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-3 text-sm font-medium text-gray-900">{supplier.name}</td>
      <td className="px-6 py-3 text-right text-sm font-medium text-blue-700">
        {fmtUSD(balances.USD)}
      </td>
      <td className="px-6 py-3 text-right text-sm font-medium text-emerald-700">
        {fmtUSD(balances.DIVISAS)}
      </td>
      <td className="px-6 py-3 text-right text-sm font-medium text-amber-700">
        {fmtCOP(balances.COP)}
      </td>
      {bcvRate && (
        <td className="px-6 py-3 text-right text-sm text-gray-500">
          {vesEquiv > 0.01 ? fmtVES(vesEquiv) : '-'}
        </td>
      )}
      <td className="px-6 py-3 text-center">
        <ViewAction onClick={onView} title="Ver estado de cuenta" />
      </td>
    </tr>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const SupplierResumenPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['supplier-resumen'],
    queryFn: async () => {
      const res = await supplierService.getResumen();
      return res.data;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Spinner size="lg" />
        <p className="text-gray-500 font-medium">Calculando saldos de proveedores...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Alert variant="error">
          <p className="font-medium mb-2">Error al cargar resumen</p>
          <p className="text-sm mb-3">{error?.message}</p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>
            <ArrowClockwise className="h-4 w-4" />
            Reintentar
          </Button>
        </Alert>
      </div>
    );
  }

  const { bcv_rate, totals, ves_needed, suppliers = [] } = data || {};

  const filtered = search
    ? suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : suppliers;

  const usdSuppliers     = filtered.filter((s) => Math.abs(s.balances.USD)     > 0.01);
  const divisasSuppliers = filtered.filter((s) => Math.abs(s.balances.DIVISAS) > 0.01);
  const copSuppliers     = filtered.filter((s) => Math.abs(s.balances.COP)     > 0.01);

  // Totales calculados sobre los proveedores visibles (respetan el filtro de búsqueda)
  const visibleTotals = {
    USD:     filtered.reduce((s, p) => s + (p.balances.USD     || 0), 0),
    DIVISAS: filtered.reduce((s, p) => s + (p.balances.DIVISAS || 0), 0),
    COP:     filtered.reduce((s, p) => s + (p.balances.COP     || 0), 0),
  };
  const visibleVesNeeded = bcv_rate ? visibleTotals.USD * parseFloat(bcv_rate) : 0;

  return (
    <div className="space-y-6">
      {/* ── Cabecera ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resumen de Proveedores</h1>
        <p className="text-gray-500 text-sm mt-1">
          Saldos por categoría de pago · {suppliers.length} proveedores con saldo
        </p>
      </div>

      {/* ── Tarjetas resumen ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total USD</span>
            <CurrencyDollar className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-blue-900">{fmtUSD(totals?.USD)}</p>
          <p className="text-xs text-blue-500 mt-1">{usdSuppliers.length} proveedor{usdSuppliers.length !== 1 ? 'es' : ''}</p>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total USD Digital</span>
            <Money className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-900">{fmtUSD(totals?.DIVISAS)}</p>
          <p className="text-xs text-emerald-500 mt-1">{divisasSuppliers.length} proveedor{divisasSuppliers.length !== 1 ? 'es' : ''}</p>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Total COP</span>
            <Bank className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-900">{fmtCOP(totals?.COP)}</p>
          <p className="text-xs text-amber-500 mt-1">{copSuppliers.length} proveedor{copSuppliers.length !== 1 ? 'es' : ''}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tasa BCV</span>
            <TrendDown className="h-5 w-5 text-gray-500" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {bcv_rate
              ? parseFloat(bcv_rate).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
              : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Bs / USD</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Bs Necesarios</span>
            <Money className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-lg font-bold text-red-900">{fmtVES(ves_needed)}</p>
          <p className="text-xs text-red-500 mt-1">Para cubrir deuda USD</p>
        </div>
      </div>

      {/* ── Búsqueda ──────────────────────────────────────────────────────────── */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar proveedor..."
        className="max-w-sm"
      />

      {/* ── Tabla ─────────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  USD
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                  USD Digital
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  COP
                </th>
                {bcv_rate && (
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Equiv. Bs
                  </th>
                )}
                <th className="px-6 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={bcv_rate ? 6 : 5} className="px-6 py-12 text-center text-gray-500">
                    {search ? 'No se encontraron proveedores' : 'No hay saldos pendientes'}
                  </td>
                </tr>
              ) : (
                <>
                  {copSuppliers
                    .sort((a, b) => b.balances.COP - a.balances.COP)
                    .map((s) => (
                      <SupplierRow
                        key={`cop-${s.id}`}
                        supplier={s}
                        bcvRate={bcv_rate}
                        onView={() => navigate(`/proveedores/${s.id}/estado-cuenta`)}
                      />
                    ))}
                  {usdSuppliers
                    .filter((s) => !copSuppliers.some((c) => c.id === s.id))
                    .sort((a, b) => b.balances.USD - a.balances.USD)
                    .map((s) => (
                      <SupplierRow
                        key={`usd-${s.id}`}
                        supplier={s}
                        bcvRate={bcv_rate}
                        onView={() => navigate(`/proveedores/${s.id}/estado-cuenta`)}
                      />
                    ))}
                  {divisasSuppliers
                    .filter((s) => !copSuppliers.some((c) => c.id === s.id) && !usdSuppliers.some((u) => u.id === s.id))
                    .sort((a, b) => b.balances.DIVISAS - a.balances.DIVISAS)
                    .map((s) => (
                      <SupplierRow
                        key={`div-${s.id}`}
                        supplier={s}
                        bcvRate={bcv_rate}
                        onView={() => navigate(`/proveedores/${s.id}/estado-cuenta`)}
                      />
                    ))}
                </>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-gray-800 text-white">
                  <td className="px-6 py-3 text-sm font-bold uppercase">Totales</td>
                  <td className="px-6 py-3 text-right text-sm font-bold">{fmtUSD(visibleTotals.USD)}</td>
                  <td className="px-6 py-3 text-right text-sm font-bold">{fmtUSD(visibleTotals.DIVISAS)}</td>
                  <td className="px-6 py-3 text-right text-sm font-bold">{fmtCOP(visibleTotals.COP)}</td>
                  {bcv_rate && (
                    <td className="px-6 py-3 text-right text-sm font-bold">{fmtVES(visibleVesNeeded)}</td>
                  )}
                  <td className="px-6 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        USD = facturas en dólares pagadas en bolívares (BCV) · USD Digital = pagos en USD (Zelle, USDT, transferencia) · COP = pesos colombianos
      </p>
    </div>
  );
};

export default SupplierResumenPage;
