import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Loader2, TrendingUp, TrendingDown,
  AlertCircle, Wallet, RotateCcw, ChevronDown, ChevronRight,
  ArrowDownRight, ArrowUpRight, Receipt, ShieldAlert, Lock, ChevronUp
} from 'lucide-react';
import { arService } from '../services/api/arService';
import { saleService } from '../services/api/saleService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ─── Utilidades ────────────────────────────────────────────────────────────────

const fmt = (amount) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(parseFloat(amount) || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const BUCKET_COLORS = {
  vigente: 'bg-green-100 text-green-800',
  '0_30': 'bg-yellow-100 text-yellow-800',
  '31_60': 'bg-orange-100 text-orange-800',
  '61_90': 'bg-red-100 text-red-800',
  '+90': 'bg-red-200 text-red-900',
  sin_termino: 'bg-gray-100 text-gray-600',
};

const BUCKET_LABELS = {
  vigente: 'Vigente', '0_30': '0-30d', '31_60': '31-60d',
  '61_90': '61-90d', '+90': '+90d', sin_termino: 'Sin término',
};

const METHOD_LABELS = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta',
  check: 'Cheque', credit_balance: 'Monedero',
};

/**
 * Determina si un pago (entry COP del ledger) puede ser revertido.
 * Reglas:
 *  - Dentro de 30 min → siempre puede
 *  - Fuera de 30 min Y hay pagos posteriores del cliente → NO puede
 */
function canReverseEntry(entry) {
  if (entry.type !== 'payment' && entry.type !== 'internal_transfer') return false;
  return entry.can_reverse === true;
}

// ─── Detalle expandible: Venta ─────────────────────────────────────────────────

const SaleExpandedDetail = ({ transaction }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    saleService.getSaleById(transaction.original_data.id)
      .then(d => setDetail(d.sale || d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [transaction.original_data.id]);

  if (loading) return (
    <div className="flex items-center gap-2 py-3 text-gray-500 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
    </div>
  );
  if (!detail) return <p className="text-red-500 text-sm py-2">No se pudo cargar el detalle.</p>;

  const rate = parseFloat(detail.exchange_rate || 1);
  const appliedCNs = transaction.original_data?.applied_credit_notes || [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span><span className="font-medium">Tipo:</span> {detail.sale_type === 'cash' ? 'Contado' : 'Crédito'}</span>
        <span><span className="font-medium">Estado:</span> {detail.status === 'completed' ? 'Completada' : detail.status === 'pending' ? 'Pendiente' : 'Cancelada'}</span>
        <span><span className="font-medium">Tasa:</span> {rate.toLocaleString('es-CO')} COP/USD</span>
        {transaction.original_data?.due_date && (
          <span><span className="font-medium">Vence:</span> {fmtDate(transaction.original_data.due_date)}</span>
        )}
      </div>

      {detail.details?.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-orange-50 text-orange-800">
              <th className="text-left px-3 py-1.5 font-semibold">Producto</th>
              <th className="text-right px-3 py-1.5 font-semibold">Cant.</th>
              <th className="text-right px-3 py-1.5 font-semibold">Precio</th>
              <th className="text-right px-3 py-1.5 font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {detail.details.map((item, i) => {
              const unitPrice = parseFloat(item.unit_price || 0);
              const qty = parseFloat(item.quantity || 0);
              const subtotal = parseFloat(item.subtotal || unitPrice * qty);
              return (
                <tr key={i} className="border-t border-orange-100">
                  <td className="px-3 py-1.5 text-gray-700">
                    {item.product?.name || item.presentation?.product?.name || '—'}
                    {item.presentation?.name && <span className="text-gray-400 ml-1">({item.presentation.name})</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-700">{qty}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700">{fmt(unitPrice * rate)}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{fmt(subtotal * rate)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-orange-200 bg-orange-50">
              <td colSpan="3" className="px-3 py-1.5 text-right font-semibold text-orange-800">Total</td>
              <td className="px-3 py-1.5 text-right font-bold text-orange-800">{fmt(parseFloat(detail.total || 0) * rate)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {appliedCNs.length > 0 && (
        <div className="border border-blue-200 rounded-lg overflow-hidden">
          <div className="bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">Devoluciones Aplicadas</div>
          <table className="w-full text-xs">
            <tbody>
              {appliedCNs.map(cn => (
                <tr key={cn.id} className="border-t border-blue-100">
                  <td className="px-3 py-1.5 text-blue-700 font-medium">{cn.number}</td>
                  <td className="px-3 py-1.5 text-gray-500">{fmtDate(cn.date)}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-blue-700">-{fmt(cn.total_cop)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Detalle expandible: Pago ──────────────────────────────────────────────────

const PaymentExpandedDetail = ({ transaction }) => {
  const pay = transaction.original_data;
  const rate = parseFloat(
    (pay.exchange_rate && parseFloat(pay.exchange_rate) !== 1)
      ? pay.exchange_rate
      : (pay.sale?.exchange_rate || 1)
  );
  const storedCurrency = pay.currency || 'USD';
  const amtOrig = parseFloat(pay.amount || 0);
  const copAmount = storedCurrency === 'COP' ? amtOrig : amtOrig * rate;

  return (
    <div className="flex flex-wrap gap-6 text-xs text-gray-600">
      <div>
        <span className="font-medium block text-gray-500 mb-0.5">Método</span>
        <span className="text-gray-800">{METHOD_LABELS[pay.payment_method] || pay.payment_method}</span>
      </div>
      <div>
        <span className="font-medium block text-gray-500 mb-0.5">Monto (COP)</span>
        <span className="text-green-700 font-semibold">{fmt(copAmount)}</span>
      </div>
      {pay.reference && (
        <div>
          <span className="font-medium block text-gray-500 mb-0.5">Referencia</span>
          <span className="text-gray-800">{pay.reference}</span>
        </div>
      )}
      {pay.sale?.sale_number && (
        <div>
          <span className="font-medium block text-gray-500 mb-0.5">Abono a</span>
          <span className="text-gray-800">{pay.sale.sale_number}</span>
        </div>
      )}
    </div>
  );
};

// ─── Detalle expandible: Nota de Crédito ──────────────────────────────────────

const CreditNoteExpandedDetail = ({ transaction }) => {
  const note = transaction.original_data;
  const rate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
  const totalCOP = Math.round(parseFloat(note.total || 0) * rate);
  const refundLabels = {
    credit_balance: 'Monedero (Saldo a Favor)', cash: 'Efectivo',
    transfer: 'Transferencia', none: 'Sin reembolso'
  };
  const typeLabels = { full: 'Devolución Total', partial: 'Devolución Parcial' };
  return (
    <div className="flex flex-wrap gap-6 text-xs text-gray-600">
      <div><span className="font-medium block text-gray-500 mb-0.5">Tipo</span>{typeLabels[note.type] || note.type}</div>
      <div><span className="font-medium block text-gray-500 mb-0.5">Reembolso</span>{refundLabels[note.refund_method] || note.refund_method}</div>
      <div>
        <span className="font-medium block text-gray-500 mb-0.5">Monto (COP)</span>
        <span className="text-blue-700 font-semibold">{fmt(totalCOP)}</span>
      </div>
    </div>
  );
};

// ─── Modal de Reversión (2 pasos) ─────────────────────────────────────────────

const ReversalModal = ({ payment, onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1 = confirmar, 2 = PIN
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const pinInputRef = useRef(null);

  useEffect(() => {
    if (step === 2) setTimeout(() => pinInputRef.current?.focus(), 100);
  }, [step]);

  const pay = payment.original_data;
  const rate = parseFloat(
    (pay.exchange_rate && parseFloat(pay.exchange_rate) !== 1)
      ? pay.exchange_rate
      : (pay.sale?.exchange_rate || 1)
  );
  const copAmount = pay.currency === 'COP'
    ? parseFloat(pay.amount || 0)
    : parseFloat(pay.amount || 0) * rate;

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const submitReversal = async (pin) => {
    if (loading) return;
    setLoading(true);
    try {
      await arService.reversePayment(pay.id, pin);
      toast.success('Abono revertido exitosamente');
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al revertir el abono';
      setPinError(msg);
      setPinValue('');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPinValue(val);
    setPinError('');
    if (val.length === 6) submitReversal(val);
  };

  const handlePinKeyDown = (e) => {
    if (e.key === 'Enter' && pinValue.length >= 4) submitReversal(pinValue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4 flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-white" />
          <h2 className="text-white font-semibold text-lg">
            {step === 1 ? 'Revertir Abono' : 'Ingresa tu PIN'}
          </h2>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <>
              {/* Resumen del abono */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Referencia</span>
                  <span className="font-medium">{payment.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha</span>
                  <span className="font-medium">{fmtDate(payment.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Método</span>
                  <span className="font-medium">{METHOD_LABELS[pay.payment_method] || pay.payment_method}</span>
                </div>
                {pay.sale?.sale_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Aplicado a</span>
                    <span className="font-medium">{pay.sale.sale_number}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600 font-medium">Monto (COP)</span>
                  <span className="font-bold text-red-700">{fmt(copAmount)}</span>
                </div>
              </div>

              {/* Advertencia */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-5 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Esta acción <strong>no se puede deshacer</strong>. El saldo de la venta se recalculará automáticamente.</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                >
                  Continuar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-5 text-center">
                Ingresa tu PIN de administrador para autorizar la reversión de <strong>{fmt(copAmount)}</strong>.
              </p>

              {/* Puntos visuales del PIN */}
              <div className="flex justify-center gap-3 mb-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full border-2 transition-all ${
                      i < pinValue.length
                        ? 'bg-red-600 border-red-600'
                        : 'bg-white border-gray-300'
                    }`}
                  />
                ))}
              </div>

              {/* Input oculto real */}
              <div className={`relative ${shaking ? 'animate-shake' : ''}`}>
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  value={pinValue}
                  onChange={handlePinChange}
                  onKeyDown={handlePinKeyDown}
                  maxLength={6}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="••••"
                  disabled={loading}
                />
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                  </div>
                )}
              </div>

              {pinError && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {pinError}
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setStep(1); setPinValue(''); setPinError(''); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={loading}
                >
                  Atrás
                </button>
                <button
                  onClick={() => submitReversal(pinValue)}
                  disabled={pinValue.length < 4 || loading}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Shake keyframe (inline style) */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

// ─── Tarjeta de resumen ────────────────────────────────────────────────────────

const SummaryCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className={`rounded-xl p-4 border ${colorClass}`}>
    <div className="flex items-center justify-between mb-1">
      <p className="text-sm font-medium opacity-80">{title}</p>
      <Icon className="h-5 w-5 opacity-70" />
    </div>
    <p className="text-xl font-bold">{fmt(value)}</p>
  </div>
);

// ─── Página principal ──────────────────────────────────────────────────────────

const ARCustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);       // { customer, summary, ledger, credit_block }
  const [expandedId, setExpandedId] = useState(null);
  const [reversalPayment, setReversalPayment] = useState(null);
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const ITEMS_PER_PAGE = 20;

  const isAdmin = hasPermission('settings.manage');

  useEffect(() => {
    const fetchStatement = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await arService.getCustomerStatement(id);
        if (res.success) setData(res.data);
        else setError('No se pudo cargar el estado de cuenta.');
      } catch (err) {
        setError('Error al cargar el estado de cuenta.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatement();
  }, [id, refetchTrigger]);

  // Ledger filtrado a COP con running balance y ordenamiento
  const copLedger = React.useMemo(() => {
    if (!data?.ledger) return [];
    let runningBalance = 0;
    const ledger = data.ledger
      .filter(t => t.currency === 'COP')
      .map(t => {
        runningBalance = t.type === 'charge'
          ? runningBalance + t.amount
          : runningBalance - t.amount;
        return { ...t, runningBalance };
      });

    // Ordenar según sortField y sortDir
    const sorted = [...ledger].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Para fechas, convertir a números
      if (sortField === 'created_at' || sortField === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      const result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDir === 'asc' ? result : -result;
    });

    return sorted;
  }, [data, sortField, sortDir]);

  const summaryCOP = data?.summary?.['COP'] || {};
  const block = data?.credit_block || {};

  // Paginación
  const totalPages = copLedger.length > 0 ? Math.ceil(copLedger.length / ITEMS_PER_PAGE) : 1;
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLedger = copLedger.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <div className="w-4 h-4" />;
    return sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  // ─── Fila del ledger ──────────────────────────────────────────────────────

  const renderRow = (entry) => {
    const isCharge = entry.type === 'charge';
    const isCredit = entry.type === 'credit';
    const isPayment = entry.type === 'payment' || entry.type === 'internal_transfer';
    const isExpanded = expandedId === entry.id;
    const canReverse = isAdmin && canReverseEntry(entry);
    const aging = entry.original_data?.aging_bucket;

    let typeLabel = '';
    let TypeIcon = null;
    let rowBg = '';
    if (isCharge) {
      typeLabel = 'Cargo';
      TypeIcon = ArrowDownRight;
      rowBg = 'hover:bg-orange-50/50';
    } else if (isCredit) {
      typeLabel = 'Devolución';
      TypeIcon = ArrowUpRight;
      rowBg = 'hover:bg-blue-50/50';
    } else if (entry.isInternal) {
      typeLabel = 'Uso Saldo';
      TypeIcon = Wallet;
      rowBg = 'hover:bg-purple-50/50';
    } else {
      typeLabel = 'Abono';
      TypeIcon = ArrowUpRight;
      rowBg = 'hover:bg-green-50/50';
    }

    // Color saldo corriente
    let balanceClass = 'text-gray-400';
    if (entry.runningBalance > 0.5) balanceClass = 'text-red-600 font-semibold';
    else if (entry.runningBalance < -0.5) balanceClass = 'text-green-600 font-semibold';

    return (
      <React.Fragment key={entry.id}>
        <tr
          className={`border-b border-gray-100 cursor-pointer transition-colors ${rowBg}`}
          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
        >
          {/* Expand toggle */}
          <td className="px-3 py-3 w-8">
            {isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              : <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            }
          </td>

          {/* Fecha */}
          <td className="px-2 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(entry.date)}</td>

          {/* Referencia + tipo */}
          <td className="px-2 py-3">
            <div className="flex items-center gap-2">
              {TypeIcon && <TypeIcon className={`h-3.5 w-3.5 flex-shrink-0 ${isCharge ? 'text-orange-500' : isCredit ? 'text-blue-500' : entry.isInternal ? 'text-purple-500' : 'text-green-600'}`} />}
              <div>
                <p className="text-xs font-medium text-gray-800">{entry.reference}</p>
                <p className="text-[10px] text-gray-400">{typeLabel}</p>
              </div>
            </div>
          </td>

          {/* Descripción */}
          <td className="px-2 py-3 text-xs text-gray-600 hidden md:table-cell max-w-[200px]">
            <span className="line-clamp-1">{entry.description}</span>
          </td>

          {/* Aging badge (solo cargos) */}
          <td className="px-2 py-3 hidden lg:table-cell">
            {isCharge && aging && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${BUCKET_COLORS[aging] || 'bg-gray-100 text-gray-600'}`}>
                {BUCKET_LABELS[aging] || aging}
              </span>
            )}
          </td>

          {/* Cargo (si aplica) */}
          <td className="px-2 py-3 text-right text-xs">
            {isCharge && (
              <span className="text-orange-700 font-medium">{fmt(entry.amount)}</span>
            )}
          </td>

          {/* Abono (si aplica) */}
          <td className="px-2 py-3 text-right text-xs">
            {!isCharge && (
              <span className={entry.isInternal ? 'text-purple-600 font-medium' : isCredit ? 'text-blue-600 font-medium' : 'text-green-600 font-medium'}>
                {fmt(entry.amount)}
              </span>
            )}
          </td>

          {/* Saldo corriente */}
          <td className={`px-2 py-3 text-right text-xs ${balanceClass}`}>
            {fmt(Math.abs(entry.runningBalance))}
            {entry.runningBalance < -0.5 && <span className="ml-0.5 text-[9px] opacity-70">a favor</span>}
          </td>

          {/* Acciones */}
          <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
            {canReverse && (
              <button
                onClick={() => setReversalPayment(entry)}
                className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors flex items-center gap-1 ml-auto"
                title="Revertir abono"
              >
                <RotateCcw className="h-3 w-3" />
                Revertir
              </button>
            )}
          </td>
        </tr>

        {/* Fila expandida */}
        {isExpanded && (
          <tr className="bg-gray-50">
            <td colSpan={9} className="px-6 py-4 border-b border-gray-100">
              {isCharge && <SaleExpandedDetail transaction={entry} />}
              {isPayment && <PaymentExpandedDetail transaction={entry} />}
              {isCredit && <CreditNoteExpandedDetail transaction={entry} />}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando estado de cuenta...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-gray-600">{error || 'No se encontraron datos.'}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-teal-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="h-5 w-px bg-gray-300" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{data.customer.name}</h1>
              {block.blocked && (
                <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-200">
                  <Lock className="h-3 w-3" />
                  BLOQUEADO: {block.reason}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {data.customer.code && <span className="mr-2">{data.customer.code}</span>}
              Estado de Cuenta
              {data.customer.creditDays > 0 && (
                <span className="ml-2 text-gray-400">· {data.customer.creditDays} días de crédito</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Aviso bloqueo ──────────────────────────────────────────────────── */}
      {block.blocked && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Cliente con crédito bloqueado</p>
            <p className="text-xs text-red-600 mt-0.5">{block.reason}. No se puede otorgar crédito adicional hasta regularizar el saldo.</p>
          </div>
        </div>
      )}

      {/* ── Tarjetas de resumen ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Facturado"
          value={summaryCOP.total_invoiced || 0}
          icon={Receipt}
          colorClass="bg-orange-50 border-orange-200 text-orange-800"
        />
        <SummaryCard
          title="Total Pagado"
          value={summaryCOP.total_paid || 0}
          icon={TrendingDown}
          colorClass="bg-green-50 border-green-200 text-green-800"
        />
        <SummaryCard
          title="Saldo Pendiente"
          value={summaryCOP.balance || 0}
          icon={TrendingUp}
          colorClass={summaryCOP.balance > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-700'}
        />
        <SummaryCard
          title="Saldo a Favor"
          value={summaryCOP.available_credit || 0}
          icon={Wallet}
          colorClass={summaryCOP.available_credit > 0 ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-gray-50 border-gray-200 text-gray-700'}
        />
      </div>

      {/* ── Tabla del ledger ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Historial de Movimientos</h2>
          <span className="text-xs text-gray-400">{copLedger.length} movimientos</span>
        </div>

        {copLedger.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay movimientos registrados.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-3 w-8" />
                    <th className="px-2 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('date')}>
                      <div className="flex items-center gap-1">Fecha <SortIcon field="date" /></div>
                    </th>
                    <th className="px-2 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('reference')}>
                      <div className="flex items-center gap-1">Referencia <SortIcon field="reference" /></div>
                    </th>
                    <th className="px-2 py-3 text-left hidden md:table-cell cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('description')}>
                      <div className="flex items-center gap-1">Descripción <SortIcon field="description" /></div>
                    </th>
                    <th className="px-2 py-3 text-left hidden lg:table-cell cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1">Estado <SortIcon field="status" /></div>
                    </th>
                    <th className="px-2 py-3 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('charge')}>
                      <div className="flex items-center justify-end gap-1">Cargo <SortIcon field="charge" /></div>
                    </th>
                    <th className="px-2 py-3 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('payment')}>
                      <div className="flex items-center justify-end gap-1">Abono <SortIcon field="payment" /></div>
                    </th>
                    <th className="px-2 py-3 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('runningBalance')}>
                      <div className="flex items-center justify-end gap-1">Saldo <SortIcon field="runningBalance" /></div>
                    </th>
                    <th className="px-3 py-3 text-right">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLedger.map(renderRow)}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {copLedger.length > ITEMS_PER_PAGE && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  Mostrando {startIdx + 1} a {Math.min(startIdx + ITEMS_PER_PAGE, copLedger.length)} de {copLedger.length} movimientos
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal de reversión ─────────────────────────────────────────────── */}
      {reversalPayment && (
        <ReversalModal
          payment={reversalPayment}
          onClose={() => setReversalPayment(null)}
          onSuccess={() => {
            setReversalPayment(null);
            setRefetchTrigger(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
};

export default ARCustomerDetailPage;
