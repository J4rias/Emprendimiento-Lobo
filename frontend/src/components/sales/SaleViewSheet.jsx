import { Printer, DeviceMobile } from '@phosphor-icons/react';
import { Sheet, Badge, Button } from '../ui';

const STATUS_VARIANT = { pending: 'warning', completed: 'success', cancelled: 'error', returned: 'neutral' };
const STATUS_LABEL   = { pending: 'Pendiente', completed: 'Completada', cancelled: 'Cancelada', returned: 'Devuelta' };
const PAYMENT_METHOD_LABEL = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta',
  usdt: 'USDT', credit_balance: 'Monedero',
};

const copFormat = (amount, rate) => {
  const val = parseFloat(amount || 0) * parseFloat(rate || 1);
  return `COP ${Math.ceil(val).toLocaleString('es-VE')}`;
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const getCustomerName = (c) => {
  if (!c) return 'Cliente General';
  if (c.type === 'juridical') return c.businessName || c.business_name || c.name || 'Cliente';
  const fn = c.firstName || c.first_name || '';
  const ln = c.lastName  || c.last_name  || '';
  return `${fn} ${ln}`.trim() || 'Cliente General';
};

const SaleViewSheet = ({ open, onClose, sale, onPrint, onPrintPortable, exchangeRates, calculateEffectiveRate }) => {
  if (!sale) return null;

  return (
    <Sheet open={open} onClose={onClose} title={`Detalle de Venta — ${sale.sale_number}`} size="xl">
      {/* Print actions */}
      <div className="flex gap-2 mb-5">
        <Button variant="ghost" size="sm" onClick={onPrint}
          className="text-blue-600 hover:bg-blue-50 border border-blue-100 text-xs font-bold">
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
              { label: 'Fecha',    value: fmtDate(sale.sale_date) },
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
                    <td className="px-3 py-2 text-right text-gray-600">{copFormat(d.unit_price, sale.exchange_rate)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{copFormat(d.total, sale.exchange_rate)}</td>
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
                      <span className="text-gray-500">{fmtDate(p.payment_date)}</span>
                      <span className="font-semibold text-slate-700 capitalize">
                        {PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method}
                      </span>
                      <span className="font-bold text-emerald-600">
                        COP {Math.ceil(amountCOP).toLocaleString('es-VE')}
                      </span>
                    </div>
                    {showRate && (
                      <p className="text-[10px] text-gray-400 pl-1">
                        {p.currency} {parseFloat(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        {' @ '}{parseFloat(p.exchange_rate).toFixed(2)} | Equiv: $ {equivUSD.toFixed(2)}
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
              <span className="text-blue-600">
                {copFormat(parseFloat(sale.subtotal) - parseFloat(sale.discount_amount || 0), sale.exchange_rate)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Monto Pagado</span>
              <span className="font-semibold text-emerald-600">{copFormat(sale.paid_amount || 0, sale.exchange_rate)}</span>
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
