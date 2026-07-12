import { PencilSimple } from '@phosphor-icons/react';
import { Sheet, Badge, Button } from '../ui';

const STATUS_VARIANT = { active: 'success', inactive: 'neutral', blocked: 'error' };
const STATUS_LABEL   = { active: 'Activo',  inactive: 'Inactivo', blocked: 'Bloqueado' };

const Field = ({ label, children, full }) => (
  <div className={full ? 'col-span-2' : ''}>
    <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">{label}</p>
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

const CustomerViewSheet = ({ open, onClose, customer, onEdit, hasPermission }) => {
  if (!customer) return null;

  const fullName = customer.type === 'natural'
    ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
    : (customer.businessName || customer.tradeName || '');

  return (
    <Sheet open={open} onClose={onClose} title={`Cliente ${customer.code}`} size="xl">
      {/* Name + status */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{fullName}</h2>
          <p className="text-xs text-gray-500">
            {customer.type === 'natural' ? 'Persona Natural' : 'Persona Jurídica'}
            {' · '}
            {customer.documentType}-{customer.documentNumber}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[customer.status] || 'neutral'} className="shrink-0">
          {STATUS_LABEL[customer.status] || customer.status}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Contacto */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Contacto</h4>
          <div className="grid grid-cols-2 gap-3">
            {customer.email && <Field label="Email">{customer.email}</Field>}
            {(customer.phone || customer.mobile) && (
              <Field label="Teléfono">{customer.phone || customer.mobile}</Field>
            )}
            {customer.address && (
              <Field label="Dirección" full>
                {customer.address}
                {customer.city  ? `, ${customer.city}`  : ''}
                {customer.state ? `, ${customer.state}` : ''}
              </Field>
            )}
          </div>
        </section>

        {/* Crédito */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Crédito</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Límite de Crédito">
              COP {Math.ceil(parseFloat(customer.creditLimit || 0)).toLocaleString('es-VE')}
            </Field>
            <Field label="Días de Crédito">{customer.creditDays || 0} días</Field>
            <Field label="Descuento">{parseFloat(customer.discountPercentage || 0).toFixed(2)}%</Field>
          </div>
        </section>

        {customer.notes && (
          <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Notas</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
          {hasPermission('customers.update') && (
            <Button onClick={onEdit} className="flex-1">
              <PencilSimple className="h-4 w-4" /> Editar
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default CustomerViewSheet;
