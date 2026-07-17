import React from 'react';
import { PencilSimple } from '@phosphor-icons/react';
import { Sheet, Badge, Button } from '../ui';
import { formatCOP } from '../../utils/formatUtils';

type BadgeVariant = 'success' | 'neutral' | 'error' | 'warning' | 'info' | 'purple' | 'outline' | 'usd' | 'cop' | 'ves' | 'usdt';
const STATUS_VARIANT: Record<string, BadgeVariant> = { active: 'success', inactive: 'neutral', blocked: 'error' };
const STATUS_LABEL: Record<string, string>   = { active: 'Activo',  inactive: 'Inactivo', blocked: 'Bloqueado' };

interface FieldProps {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}

const Field = ({ label, children, full }: FieldProps) => (
  <div className={full ? 'col-span-2' : ''}>
    <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">{label}</p>
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

interface Customer {
  code: string;
  type: 'natural' | 'juridica';
  firstName?: string;
  lastName?: string;
  businessName?: string;
  tradeName?: string;
  documentType: string;
  documentNumber: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  creditLimit?: number;
  creditDays?: number;
  discountPercentage?: number;
  notes?: string | null;
}

interface CustomerViewSheetProps {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onEdit: () => void;
  hasPermission: (permission: string) => boolean;
}

const CustomerViewSheet = ({ open, onClose, customer, onEdit, hasPermission }: CustomerViewSheetProps) => {
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
              {formatCOP(customer.creditLimit || 0)}
            </Field>
            <Field label="Días de Crédito">{customer.creditDays || 0} días</Field>
            <Field label="Descuento">{(customer.discountPercentage ?? 0).toFixed(2)}%</Field>
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
