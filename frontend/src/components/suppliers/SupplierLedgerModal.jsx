import { useState, useEffect } from 'react';
import { X, WarningCircle, FileText, Money } from '@phosphor-icons/react';
import { Spinner } from '../ui';
import { supplierService } from '../../services/api/supplierService';

// --- Formatters ---
const fmtUSD = (v) => {
  const val = parseFloat(v) || 0;
  return `$ ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtCOP = (v) => {
  const val = parseFloat(v) || 0;
  return `$ ${Math.ceil(val).toLocaleString('es-VE')}`;
};

const fmtVES = (v) => {
  const val = parseFloat(v) || 0;
  if (Math.abs(val) < 0.01) return '-';
  return `Bs ${Math.ceil(val).toLocaleString('es-VE')}`;
};

const fmtRate = (v) => {
  const val = parseFloat(v) || 0;
  return val.toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Category display config
const CATEGORY_CONFIG = {
  USD: { label: 'USD', sublabel: 'Pago en Bolívares', color: 'blue', fmtAmount: fmtUSD },
  DIVISAS: { label: 'DIVISAS', sublabel: 'Pago en USD / Zelle', color: 'emerald', fmtAmount: fmtUSD },
  COP: { label: 'COP', sublabel: 'Pago en Pesos', color: 'amber', fmtAmount: fmtCOP },
};

const TAB_COLORS = {
  blue: { active: 'bg-blue-600 text-white', inactive: 'text-blue-700 hover:bg-blue-50' },
  emerald: { active: 'bg-emerald-600 text-white', inactive: 'text-emerald-700 hover:bg-emerald-50' },
  amber: { active: 'bg-amber-600 text-white', inactive: 'text-amber-700 hover:bg-amber-50' },
};

const SupplierLedgerModal = ({ supplier, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    if (supplier?.id) fetchLedger();
  }, [supplier]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await supplierService.getLedger(supplier.id);
      if (res.data) {
        setLedgerData(res.data);
        // Auto-select first category with data
        const cats = Object.keys(res.data.categories || {});
        if (cats.length > 0) {
          // Prefer: USD > DIVISAS > COP
          const preferred = ['USD', 'DIVISAS', 'COP'].find(c => cats.includes(c));
          setActiveTab(preferred || cats[0]);
        }
      }
    } catch (err) {
      setError('Error al cargar el estado de cuenta.');
      console.error('Error fetching ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ledgerData?.categories || {};
  const catKeys = Object.keys(categories);
  const activeCat = categories[activeTab];
  const config = CATEGORY_CONFIG[activeTab] || CATEGORY_CONFIG.USD;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Overlay */}
        <div className="fixed inset-0 bg-gray-900/75" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 rounded-t-2xl flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-gray-300" />
                <div>
                  <h3 className="text-lg font-bold text-white">Estado de Cuenta</h3>
                  <p className="text-gray-400 text-sm">{supplier?.name}</p>
                </div>
              </div>
              {/* Balance badge */}
              {activeCat && (
                <div className="hidden sm:flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Saldo Pendiente</p>
                    <p className={`text-xl font-bold ${activeCat.balance > 0.01 ? 'text-red-400' : 'text-green-400'}`}>
                      {config.fmtAmount(activeCat.balance)}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors ml-4"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                <Spinner size="lg" />
                <p className="text-gray-500 text-sm">Cargando estado de cuenta...</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3">
                  <WarningCircle className="h-5 w-5" />
                  <p>{error}</p>
                </div>
              </div>
            ) : catKeys.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-20 text-gray-500">
                No hay operaciones registradas para este proveedor.
              </div>
            ) : (
              <>
                {/* Category Tabs */}
                <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2 flex-shrink-0">
                  {catKeys.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.USD;
                    const colors = TAB_COLORS[cfg.color] || TAB_COLORS.blue;
                    const isActive = activeTab === cat;
                    const catData = categories[cat];
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive ? colors.active : colors.inactive}`}
                      >
                        {cfg.label}
                        <span className={`ml-2 text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                          ({cfg.fmtAmount(catData.balance)})
                        </span>
                      </button>
                    );
                  })}

                  {/* BCV Rate */}
                  {ledgerData?.bcv_rate && (
                    <div className="ml-auto text-xs text-gray-500">
                      BCV: <span className="font-semibold text-gray-700">{fmtRate(ledgerData.bcv_rate)}</span>
                    </div>
                  )}
                </div>

                {/* Side-by-side tables */}
                {activeCat && (
                  <div className="flex-1 overflow-auto p-4">
                    {/* Mobile: stacked, Desktop: side-by-side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                      {/* LEFT: Invoices/Facturas */}
                      <InvoicesTable
                        invoices={activeCat.invoices}
                        category={activeTab}
                        config={config}
                        total={activeCat.total_invoiced}
                      />

                      {/* RIGHT: Payments/Pagos */}
                      <PaymentsTable
                        payments={activeCat.payments}
                        category={activeTab}
                        config={config}
                        total={activeCat.total_paid}
                      />
                    </div>

                    {/* Summary bar */}
                    <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-xs text-gray-500">Total Facturado</p>
                          <p className="text-lg font-bold text-gray-900">{config.fmtAmount(activeCat.total_invoiced)}</p>
                        </div>
                        <div className="text-2xl text-gray-300 font-light">&minus;</div>
                        <div>
                          <p className="text-xs text-gray-500">Total Pagado</p>
                          <p className="text-lg font-bold text-green-700">{config.fmtAmount(activeCat.total_paid)}</p>
                        </div>
                        <div className="text-2xl text-gray-300 font-light">=</div>
                        <div>
                          <p className="text-xs text-gray-500">Saldo</p>
                          <p className={`text-lg font-bold ${activeCat.balance > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                            {config.fmtAmount(activeCat.balance)}
                          </p>
                        </div>
                      </div>
                      {activeTab === 'USD' && ledgerData?.bcv_rate && activeCat.balance > 0.01 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Bolívares necesarios (aprox.)</p>
                          <p className="text-sm font-semibold text-gray-700">
                            {fmtVES(activeCat.balance * parseFloat(ledgerData.bcv_rate))}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Invoices Table (Left Side) ---
const InvoicesTable = ({ invoices, category, config, total }) => {
  const isCOP = category === 'COP';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-orange-800 text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Facturas
          </h4>
          <span className="text-xs text-orange-600">{invoices.length} registros</span>
        </div>
      </div>
      <div className="overflow-auto max-h-[400px]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Fecha</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Descripción</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
                Monto ({isCOP ? 'COP' : 'USD'})
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400 text-xs">Sin facturas</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-orange-50/50">
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(inv.date)}</td>
                  <td className="px-3 py-2 text-gray-800 font-medium">{inv.description}</td>
                  <td className="px-3 py-2 text-right font-medium text-orange-700 whitespace-nowrap">
                    {config.fmtAmount(inv.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-orange-100 border-t-2 border-orange-300">
              <td colSpan={2} className="px-3 py-2 font-bold text-orange-900 text-xs uppercase">Total</td>
              <td className="px-3 py-2 text-right font-bold text-orange-900">{config.fmtAmount(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// --- Payments Table (Right Side) ---
const PaymentsTable = ({ payments, category, config, total }) => {
  const isUSD = category === 'USD';
  const isCOP = category === 'COP';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="bg-green-50 px-4 py-2.5 border-b border-green-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-green-800 text-sm flex items-center gap-2">
            <Money className="h-4 w-4" /> Pagos
          </h4>
          <span className="text-xs text-green-600">{payments.length} registros</span>
        </div>
      </div>
      <div className="overflow-auto max-h-[400px]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Fecha</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Descripción</th>
              {isUSD && (
                <>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">BCV</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Monto (Bs)</th>
                </>
              )}
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
                Total ({isCOP ? 'COP' : 'USD'})
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={isUSD ? 5 : 3} className="px-3 py-6 text-center text-gray-400 text-xs">
                  Sin pagos registrados
                </td>
              </tr>
            ) : (
              payments.map((pay, idx) => (
                <tr key={`${pay.id}-${idx}`} className="hover:bg-green-50/50">
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(pay.date)}</td>
                  <td className="px-3 py-2 text-gray-800 font-medium truncate max-w-[200px]" title={pay.description}>
                    {pay.description}
                  </td>
                  {isUSD && (
                    <>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap text-xs">
                        {pay.bcv_rate ? fmtRate(pay.bcv_rate) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap text-xs">
                        {pay.amount_ves ? fmtVES(pay.amount_ves) : '-'}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right font-medium text-green-700 whitespace-nowrap">
                    {config.fmtAmount(pay.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 border-t-2 border-green-300">
              <td colSpan={isUSD ? 4 : 2} className="px-3 py-2 font-bold text-green-900 text-xs uppercase">Total</td>
              <td className="px-3 py-2 text-right font-bold text-green-900">{config.fmtAmount(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default SupplierLedgerModal;
