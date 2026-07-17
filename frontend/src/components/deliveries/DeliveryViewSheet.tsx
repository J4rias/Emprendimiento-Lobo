import React from 'react';
import { Sheet, Badge, Button } from '../ui';
import { formatDateShort } from '../../utils/formatUtils';

const STATUS_VARIANT: Record<string, string> = { pending:'warning', in_transit:'info', delivered:'success', cancelled:'error' };
const STATUS_LABEL: Record<string, string>   = { pending:'Pendiente', in_transit:'En Tránsito', delivered:'Entregado', cancelled:'Cancelado' };
const DELIVERY_METHODS: Record<string, string> = {
  pickup: 'Retiro en Tienda', courier: 'Mensajería',
  own_fleet: 'Flota Propia', shipping_company: 'Transportadora',
};

interface FieldProps {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, children, full }) => (
  <div className={full ? 'col-span-2' : ''}>
    <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">{label}</p>
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

interface DeliveryDetail {
  product?: { name: string };
  presentation?: { name: string };
  package_quantity_delivered: number;
  loose_units_delivered: number;
}

interface Delivery {
  delivery_number: string;
  sale?: { sale_number: string; sale_date: string };
  status: string;
  scheduled_date: string;
  delivery_date?: string;
  customer?: { name: string; phone?: string };
  delivery_method: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  contact_name?: string;
  contact_phone?: string;
  carrier?: string;
  tracking_number?: string;
  details?: DeliveryDetail[];
  notes?: string;
}

interface DeliveryViewSheetProps {
  open: boolean;
  onClose: () => void;
  delivery: Delivery | null;
}

const DeliveryViewSheet: React.FC<DeliveryViewSheetProps> = ({ open, onClose, delivery }) => {
  if (!delivery) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Detalle de Entrega" size="xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{delivery.delivery_number}</h2>
          <p className="text-xs text-gray-500">
            Venta: {delivery.sale?.sale_number}
            {delivery.sale?.sale_date ? ` · ${formatDateShort(delivery.sale.sale_date)}` : ''}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[delivery.status] || 'neutral'} className="shrink-0">
          {STATUS_LABEL[delivery.status] || delivery.status}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Fechas */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha Programada">
              {formatDateShort(delivery.scheduled_date)}
            </Field>
            {delivery.delivery_date && (
              <Field label="Fecha de Entrega">
                {formatDateShort(delivery.delivery_date)}
              </Field>
            )}
          </div>
        </section>

        {/* Info de entrega */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Información de Entrega</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <p>{delivery.customer?.name}</p>
              {delivery.customer?.phone && <p className="text-xs text-gray-500">{delivery.customer.phone}</p>}
            </Field>
            <Field label="Método">
              {DELIVERY_METHODS[delivery.delivery_method] || delivery.delivery_method || '-'}
            </Field>
            <Field label="Dirección" full>
              <p>{delivery.delivery_address}</p>
              {(delivery.delivery_city || delivery.delivery_state) && (
                <p className="text-xs text-gray-500">
                  {[delivery.delivery_city, delivery.delivery_state].filter(Boolean).join(', ')}
                </p>
              )}
            </Field>
            {delivery.contact_name && (
              <Field label="Contacto">
                <p>{delivery.contact_name}</p>
                {delivery.contact_phone && <p className="text-xs text-gray-500">{delivery.contact_phone}</p>}
              </Field>
            )}
            {delivery.carrier && <Field label="Transportadora">{delivery.carrier}</Field>}
            {delivery.tracking_number && (
              <Field label="Tracking" full>
                <span className="text-primary-600 font-medium">{delivery.tracking_number}</span>
              </Field>
            )}
          </div>
        </section>

        {/* Productos */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Productos Entregados</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {delivery.details?.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">{d.product?.name}</p>
                      <p className="text-xs text-gray-500">{d.presentation?.name}</p>
                    </td>
                    <td className="px-3 py-2 text-center text-sm text-gray-700">
                      {d.package_quantity_delivered}p + {d.loose_units_delivered}u
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {delivery.notes && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Notas</p>
            <p className="text-gray-700">{delivery.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="w-full">Cerrar</Button>
        </div>
      </div>
    </Sheet>
  );
};

export default DeliveryViewSheet;
