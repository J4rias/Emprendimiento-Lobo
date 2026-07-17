import { PencilSimple } from '@phosphor-icons/react';
import { Calendar, Clock, Tag, AddressBook, User, Envelope, Phone, NotePencil } from '@phosphor-icons/react';
import { Sheet, Badge, Button, Card } from '../ui';
import { formatDateShort } from '../../utils/formatUtils';

interface SupplierContact {
  id: number;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
}

interface Supplier {
  id: number;
  name: string;
  tax_id: string | null;
  is_active: boolean;
  payment_terms: string | null;
  notes: string | null;
  contacts?: SupplierContact[];
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

interface SupplierViewSheetProps {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onEdit: () => void;
  hasPermission: (permission: string) => boolean;
}

const fmtDate = (d: string | null | undefined): string => formatDateShort(d);

const SupplierViewSheet: React.FC<SupplierViewSheetProps> = ({ open, onClose, supplier, onEdit, hasPermission }) => {
  if (!supplier) return null;

  return (
    <Sheet open={open} onClose={onClose} title={supplier.name} size="xl">
      {/* Name + status */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{supplier.name}</h2>
          {supplier.tax_id && <p className="text-xs text-gray-500">RIF: {supplier.tax_id}</p>}
        </div>
        <Badge variant={supplier.is_active ? 'success' : 'error'} className="shrink-0">
          {supplier.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Info básica */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Tag className="h-4 w-4" /> Información Básica
          </h4>
          <div className="space-y-2 text-sm">
            {supplier.payment_terms && (
              <div>
                <p className="text-xs text-gray-500">Condiciones de Pago</p>
                <p className="text-gray-900">{supplier.payment_terms}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
                  <Calendar className="h-3 w-3" /> Creado
                </p>
                <p className="text-gray-900">{fmtDate(supplier.createdAt || supplier.created_at)}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
                  <Clock className="h-3 w-3" /> Actualizado
                </p>
                <p className="text-gray-900">{fmtDate(supplier.updatedAt || supplier.updated_at)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contactos */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <AddressBook className="h-4 w-4" /> Contactos
          </h4>
          {supplier.contacts?.length ? (
            <div className="space-y-3">
              {supplier.contacts.map((c) => (
                <div key={c.id} className="border border-gray-200 rounded-lg p-3 space-y-1 bg-white">
                  {c.is_primary && <Badge variant="info" className="mb-1">Contacto Principal</Badge>}
                  <div className="flex items-center gap-2 font-medium text-sm text-gray-900">
                    <User className="h-4 w-4 text-gray-400" /> {c.name}
                    {c.position && <span className="font-normal text-gray-500">— {c.position}</span>}
                  </div>
                  {c.email  && <div className="flex items-center gap-2 text-xs text-gray-600"><Envelope  className="h-3 w-3" /> {c.email}</div>}
                  {c.phone  && <div className="flex items-center gap-2 text-xs text-gray-600"><Phone className="h-3 w-3" /> {c.phone}</div>}
                  {c.mobile && <div className="flex items-center gap-2 text-xs text-gray-600"><Phone className="h-3 w-3" /> Móvil: {c.mobile}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin contactos registrados</p>
          )}
        </section>

        {supplier.notes && (
          <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <NotePencil className="h-4 w-4" /> Notas
            </h4>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{supplier.notes}</p>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
          {hasPermission('suppliers.update') && supplier.is_active && (
            <Button onClick={onEdit} className="flex-1">
              <PencilSimple className="h-4 w-4" /> Editar
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default SupplierViewSheet;
