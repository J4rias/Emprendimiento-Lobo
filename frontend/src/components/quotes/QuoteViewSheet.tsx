import React from 'react';
import { PaperPlaneRight, XCircle, CheckCircle, ArrowCircleRight } from '@phosphor-icons/react';
import { Sheet, Badge, Button } from '../ui';
import { formatUSD, formatDateShort } from '../../utils/formatUtils';

const STATUS_VARIANT: Record<string, string> = {
  draft:'neutral', sent:'info', approved:'success',
  rejected:'error', converted:'purple', expired:'warning',
};
const STATUS_LABEL: Record<string, string> = {
  draft:'Borrador', sent:'Enviada', approved:'Aprobada',
  rejected:'Rechazada', converted:'Convertida', expired:'Vencida',
};

const fmtDate = (d: string | Date | null | undefined): string => formatDateShort(d);

const fmtUSD = (v: string | number): string => formatUSD(v);

const customerName = (c: Record<string, unknown> | null | undefined): string => {
  if (!c) return '—';
  if (c.business_name || c.businessName) return (c.business_name || c.businessName) as string;
  return `${(c.first_name || c.firstName || '') as string} ${(c.last_name || c.lastName || '') as string}`.trim() || '—';
};

interface StatusMutation {
  isPending?: boolean;
}

interface QuoteViewSheetProps {
  open: boolean;
  onClose: () => void;
  quote: Record<string, unknown> | null;
  hasPermission: (permission: string) => boolean;
  onStatusChange: (quote: Record<string, unknown>, status: string) => void;
  onConvert: (quote: Record<string, unknown>) => void;
  statusMutation?: StatusMutation;
}

const QuoteViewSheet: React.FC<QuoteViewSheetProps> = ({ open, onClose, quote, hasPermission, onStatusChange, onConvert, statusMutation }) => {
  if (!quote) return null;

  return (
    <Sheet open={open} onClose={onClose} title={`Cotización ${quote.code}`} size="xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{customerName(quote.customer)}</h2>
          <p className="text-xs text-gray-500">
            {fmtDate(quote.quote_date || quote.quoteDate)} · Vence: {fmtDate(quote.valid_until || quote.validUntil)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[quote.status] || 'neutral'} className="shrink-0">
          {STATUS_LABEL[quote.status] || quote.status}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Info */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Vendedor</p>
              <p className="text-gray-900">{quote.user?.first_name} {quote.user?.last_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Moneda</p>
              <p className="text-gray-900">{quote.currency || 'USD'}</p>
            </div>
            {quote.converted_to_sale_id && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Venta generada</p>
                <p className="text-teal-700 font-medium">ID #{quote.converted_to_sale_id}</p>
              </div>
            )}
          </div>
        </section>

        {/* Productos */}
        {quote.details?.length > 0 && (
          <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Productos</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-100 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Producto</th>
                    <th className="text-right px-3 py-2">Cant.</th>
                    <th className="text-right px-3 py-2">P.Unit</th>
                    <th className="text-right px-3 py-2">Desc.</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {quote.details.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800">{d.product?.name || d.description}</p>
                        {d.presentation && <p className="text-xs text-gray-400">{d.presentation.name}</p>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{parseFloat(d.quantity)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmtUSD(d.unit_price)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {parseFloat(d.discount_percentage || 0) > 0 ? `${parseFloat(d.discount_percentage)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmtUSD(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {quote.notes && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Notas</p>
            <p className="text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Totales */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-1 text-sm">
          {parseFloat(quote.discount_amount || 0) > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Descuento</span><span>- {fmtUSD(quote.discount_amount)}</span>
            </div>
          )}
          {parseFloat(quote.tax_amount || 0) > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>IVA ({parseFloat(quote.tax_percentage || 0)}%)</span>
              <span>{fmtUSD(quote.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
            <span>Total</span><span>{fmtUSD(quote.total)}</span>
          </div>
        </section>

        {/* Workflow actions */}
        {hasPermission('sales.quotes.update') && quote.status !== 'converted' && (
          <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Acciones</h4>
            <div className="flex flex-wrap gap-2">
              {['draft', 'sent'].includes(quote.status) && (
                <>
                  <Button variant="secondary" size="sm" loading={statusMutation?.isPending}
                    onClick={() => onStatusChange(quote, 'sent')} disabled={quote.status === 'sent'}>
                    <PaperPlaneRight className="h-4 w-4" /> Marcar enviada
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50"
                    loading={statusMutation?.isPending} onClick={() => onStatusChange(quote, 'rejected')}>
                    <XCircle className="h-4 w-4" /> Rechazar
                  </Button>
                  <Button size="sm" loading={statusMutation?.isPending}
                    onClick={() => onStatusChange(quote, 'approved')}>
                    <CheckCircle className="h-4 w-4" /> Aprobar
                  </Button>
                </>
              )}
              {quote.status === 'approved' && (
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => { onConvert(quote); onClose(); }}>
                  <ArrowCircleRight className="h-4 w-4" /> Convertir a Venta
                </Button>
              )}
            </div>
          </section>
        )}

        <div className="pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="w-full">Cerrar</Button>
        </div>
      </div>
    </Sheet>
  );
};

export default QuoteViewSheet;
