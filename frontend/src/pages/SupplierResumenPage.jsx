import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  Banknote,
  Landmark,
  TrendingDown,
  Loader,
  AlertCircle,
  Eye,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supplierService } from '../services/api/supplierService';
import SupplierLedgerModal from '../components/suppliers/SupplierLedgerModal';

// Format USD/DIVISAS amounts: $ 1.234,56
const fmtUSD = (v) => {
  const val = parseFloat(v) || 0;
  if (Math.abs(val) < 0.01) return '-';
  return `$ ${val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format COP amounts: $ 1.234.567 (no decimals)
const fmtCOP = (v) => {
  const val = parseFloat(v) || 0;
  if (Math.abs(val) < 1) return '-';
  return `$ ${Math.round(val).toLocaleString('es-ES')}`;
};

// Format VES amounts: Bs 1.234.567 (no decimals)
const fmtVES = (v) => {
  const val = parseFloat(v) || 0;
  if (Math.abs(val) < 1) return '-';
  return `Bs ${Math.round(val).toLocaleString('es-ES')}`;
};

const SupplierResumenPage = () => {
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['supplier-resumen'],
    queryFn: async () => {
      const res = await supplierService.getResumen();
      return res.data;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Calculando saldos de proveedores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
        <p className="text-red-600 font-medium mb-2">Error al cargar resumen</p>
        <p className="text-gray-500 text-sm">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Reintentar
        </button>
      </div>
    );
  }

  const { bcv_rate, totals, ves_needed, suppliers = [] } = data || {};

  // Filter suppliers by search
  const filtered = search
    ? suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : suppliers;

  // Separate suppliers by category for the spreadsheet-like sorting
  const usdSuppliers = filtered.filter((s) => Math.abs(s.balances.USD) > 0.01);
  const divisasSuppliers = filtered.filter((s) => Math.abs(s.balances.DIVISAS) > 0.01);
  const copSuppliers = filtered.filter((s) => Math.abs(s.balances.COP) > 0.01);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resumen de Proveedores</h1>
          <p className="text-gray-500 text-sm mt-1">
            Saldos pendientes por categoría de pago
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total USD */}
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total USD</span>
            <DollarSign className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-blue-900">{fmtUSD(totals?.USD)}</p>
          <p className="text-xs text-blue-500 mt-1">Pagos en Bolívares</p>
        </div>

        {/* Total DIVISAS */}
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Divisas</span>
            <Banknote className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-900">{fmtUSD(totals?.DIVISAS)}</p>
          <p className="text-xs text-emerald-500 mt-1">Pagos en USD / Zelle</p>
        </div>

        {/* Total COP */}
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Total COP</span>
            <Landmark className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-900">{fmtCOP(totals?.COP)}</p>
          <p className="text-xs text-amber-500 mt-1">Pagos en Pesos</p>
        </div>

        {/* Tasa BCV */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tasa BCV</span>
            <TrendingDown className="h-5 w-5 text-gray-500" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {bcv_rate ? parseFloat(bcv_rate).toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Bs / USD</p>
        </div>

        {/* Bs Necesarios */}
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Bs Necesarios</span>
            <Banknote className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-lg font-bold text-red-900">{fmtVES(ves_needed)}</p>
          <p className="text-xs text-red-500 mt-1">Para cubrir deuda USD</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                  Divisas
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  COP
                </th>
                {bcv_rate && (
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Equiv. Bs
                  </th>
                )}
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                </th>
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
                  {/* COP suppliers first (sorted by balance desc) */}
                  {copSuppliers
                    .sort((a, b) => b.balances.COP - a.balances.COP)
                    .map((s) => (
                      <SupplierRow key={`cop-${s.id}`} supplier={s} bcvRate={bcv_rate} onView={() => setSelectedSupplier(s)} />
                    ))}

                  {/* USD suppliers (sorted by balance desc) */}
                  {usdSuppliers
                    .filter((s) => !copSuppliers.some((c) => c.id === s.id))
                    .sort((a, b) => b.balances.USD - a.balances.USD)
                    .map((s) => (
                      <SupplierRow key={`usd-${s.id}`} supplier={s} bcvRate={bcv_rate} onView={() => setSelectedSupplier(s)} />
                    ))}

                  {/* DIVISAS suppliers (sorted by balance desc) */}
                  {divisasSuppliers
                    .filter((s) => !copSuppliers.some((c) => c.id === s.id) && !usdSuppliers.some((u) => u.id === s.id))
                    .sort((a, b) => b.balances.DIVISAS - a.balances.DIVISAS)
                    .map((s) => (
                      <SupplierRow key={`div-${s.id}`} supplier={s} bcvRate={bcv_rate} onView={() => setSelectedSupplier(s)} />
                    ))}
                </>
              )}
            </tbody>
            {/* Totals Footer */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-gray-800 text-white">
                  <td className="px-6 py-3 text-sm font-bold uppercase">Totales</td>
                  <td className="px-6 py-3 text-right text-sm font-bold">{fmtUSD(totals?.USD)}</td>
                  <td className="px-6 py-3 text-right text-sm font-bold">{fmtUSD(totals?.DIVISAS)}</td>
                  <td className="px-6 py-3 text-right text-sm font-bold">{fmtCOP(totals?.COP)}</td>
                  {bcv_rate && (
                    <td className="px-6 py-3 text-right text-sm font-bold">{fmtVES(ves_needed)}</td>
                  )}
                  <td className="px-6 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Info */}
      <p className="text-xs text-gray-400 text-center">
        USD = facturas en dólares pagadas en bolívares (BCV) · Divisas = pagos directos en USD (Zelle) · COP = pesos colombianos
      </p>

      {/* Ledger Modal */}
      {selectedSupplier && (
        <SupplierLedgerModal
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
        />
      )}
    </div>
  );
};

// Row component
const SupplierRow = ({ supplier, bcvRate, onView }) => {
  const { balances } = supplier;
  const vesEquiv = bcvRate ? (balances.USD || 0) * parseFloat(bcvRate) : 0;

  return (
    <tr className="hover:bg-blue-50/40 transition-colors">
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
        <button
          onClick={onView}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Ver detalle"
        >
          <Eye className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
};

export default SupplierResumenPage;
