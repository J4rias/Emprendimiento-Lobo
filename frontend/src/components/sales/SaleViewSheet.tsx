import React from 'react';
import { Printer, DeviceMobile } from '@phosphor-icons/react';
import { Sheet, Badge, Button } from '../ui';
import { formatCOP, formatUSD, formatDateShort, LOCALE } from '../../utils/formatUtils';

const STATUS_VARIANT: Record<string, string> = { pending: 'warning', completed: 'success', cancelled: 'error', returned: 'neutral' };
const STATUS_LABEL: Record<string, string>   = { pending: 'Pendiente', completed: 'Completada', cancelled: 'Cancelada', returned: 'Devuelta' };
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta',
  usdt: 'USDT', credit_balance: 'Monedero',
};

const copFormat = (amount: string | number, rate: string | number): string => {
  const val = parseFloat(String(amount || 0)) * parseFloat(String(rate || 1));
  return formatCOP(val);
};

const fmtByCurrency = (usdAmount: string | number, sale: Record<string, unknown>): string => {
  const val = parseFloat(String(usdAmount || 0));
  if (sale.currency_mode === 'USD') return formatUSD(val);
  const rate = parseFloat(String(sale.exchange_rate || 1));
  return formatCOP(val * rate);
};

const getCustomerName = (c: Record<string, unknown> | null | undefined): string => {
  if (!c) return 'Cliente General';
  if (c.type === 'juridical') return (c.businessName || c.business_name || c.name || 'Cliente') as string;
  const fn = (c.firstName || c.first_name || '') as string;
  const ln = (c.lastName  || c.last_name  || '') as string;
  return `${fn} ${ln}`.trim() || 'Cliente General';
};

interface ExchangeRate {
  id: number;
  [key: string]: unknown;
}

interface SaleViewSheetProps {
  open: boolean;
  onClose: () => void;
  sale: Record<string, unknown> | null;
  onPrint: () => void;
  onPrintPortable: () => void;
  exchangeRates?: ExchangeRate[];
  calculateEffectiveRate?: (from: string, to: string, rates: ExchangeRate[]) => number;
}

const SaleViewSheet: React.FC<SaleViewSheetProps> = ({ open, onClose, sale, onPrint, onPrintPortable, exchangeRates, calculateEffectiveRate }) => {
  if (!sale) return null;

  return (
    <Sheet open={open} onClose={onClose} title={`Detalle de Venta — ${sale.sale_number}`} size="xl">
      {/* Print actions */}
      <div className="flex gap-2 mb-5">
        <Button variant="ghost" size="sm" onClick={onPrint}
          className="text-primary-600 hover:bg-primary-50 border border-primary-100 text-xs font-bold">
          <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir
        </Button>
        <Button variant="ghost" size="sm" onClick={onPrintPortable}
          className="text-amber-600 hover:bg-amber-50 border border-amber-100 text-xs font-bold">
          <DeviceMobile className="w-3.5 h-3.5 mr-1" /> Portátil
        </Button>
      </div>

      <div className="space-y-4">
        {/* Metadata */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Fecha',    value: formatDateShort(sale.sale_date) },
              { label: 'Cliente',  value: getCustomerName(sale.customer) },
              { label: 'Vendedor', value: sale.seller?.first_name || sale.seller?.username || 'N/A' },
              { label: 'Almacén',  value: sale.warehouse?.name },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">{label}</p>
                <p className="text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Items */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Productos</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left   text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                  <th className="px-3 py-2 text-right  text-xs font-semibold text-gray-500 uppercase">P.Unit</th>
                  <th className="px-3 py-2 text-right  text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sale.details?.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-800">{d.product?.name}</p>
                      <p className="text-xs text-gray-400">{d.presentation?.name}</p>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">{parseFloat(d.quantity)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmtByCurrency(d.unit_price, sale)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{fmtByCurrency(d.total, sale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Payments + Totals */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Historial de Pagos</h4>
          {sale.payments?.length > 0 ? (
            <div className="space-y-2">
              {sale.payments.map((p, i) => {
                let amountCOP = parseFloat(p.amount || 0);
                if (p.currency !== 'COP') {
                  const amountUSD = amountCOP / parseFloat(p.exchange_rate || 1);
                  amountCOP = amountUSD * parseFloat(sale.exchange_rate || calculateEffectiveRate?.('USD', 'COP', exchangeRates) || 1);
                }
                const showRate = p.currency && p.currency !== 'USD';
                const equivUSD = showRate ? parseFloat(p.amount || 0) / parseFloat(p.exchange_rate || 1) : null;
                return (
                  <div key={i} className="bg-white p-2 rounded border border-gray-200 space-y-0.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">{formatDateShort(p.payment_date)}</span>
                      <span className="font-semibold text-slate-700 capitalize">
                        {PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method}
                      </span>
                      <span className="font-bold text-emerald-600">
                        {sale.currency_mode === 'USD'
                          ? formatUSD(parseFloat(p.amount || 0) / parseFloat(p.exchange_rate || 1))
                          : formatCOP(amountCOP)}
                      </span>
                    </div>
                    {showRate && (
                      <p className="text-[10px] text-gray-400 pl-1">
                        {p.currency} {parseFloat(p.amount).toLocaleString(LOCALE, { minimumFractionDigits: p.currency === 'USD' ? 2 : 0, maximumFractionDigits: 2 })}
                        {' @ '}{parseFloat(p.exchange_rate).toFixed(2)} | Equiv: {formatUSD(equivUSD)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No hay pagos registrados</p>
          )}

          <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
            <div className="flex justify-between font-bold text-base text-gray-900">
              <span>Total</span>
              <span className="text-primary-600">
                {fmtByCurrency(parseFloat(sale.subtotal) - parseFloat(sale.discount_amount || 0), sale)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Monto Pagado</span>
              <span className="font-semibold text-emerald-600">{fmtByCurrency(sale.paid_amount || 0, sale)}</span>
            </div>
          </div>
        </section>

        {sale.notes && (
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
            <p className="text-[11px] font-bold text-amber-800 uppercase mb-1">Notas / Observaciones</p>
            <p className="text-xs text-amber-900 whitespace-pre-wrap">{sale.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="w-full">Cerrar</Button>
        </div>
      </div>
    </Sheet>
  );
};

export default SaleViewSheet;
