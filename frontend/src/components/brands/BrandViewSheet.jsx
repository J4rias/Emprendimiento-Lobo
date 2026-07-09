import { PencilSimple, Globe } from '@phosphor-icons/react';
import { Sheet, Badge, Button } from '../ui';

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const Field = ({ label, children }) => (
  <div>
    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

const BrandViewSheet = ({ open, onClose, brand, onEdit, hasPermission }) => {
  if (!brand) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Detalles de la Marca" size="lg">
      {/* Logo + name */}
      {brand.logo_url && (
        <div className="flex justify-center mb-5">
          <img src={brand.logo_url} alt={brand.name} className="h-24 w-24 object-contain rounded-lg border border-gray-200 bg-gray-50 p-2" />
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-bold text-gray-900">{brand.name}</h2>
        <Badge variant={brand.is_active ? 'success' : 'error'} className="shrink-0">
          {brand.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      <div className="space-y-4">
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
          {brand.description && <Field label="Descripción">{brand.description}</Field>}
          {brand.website && (
            <Field label="Sitio Web">
              <a href={brand.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary-600 hover:text-primary-900">
                <Globe className="h-4 w-4" /> {brand.website}
              </a>
            </Field>
          )}
          {brand.notes && <Field label="Notas">{brand.notes}</Field>}
        </section>

        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
          <div><p>Creado</p><p className="text-gray-700">{fmtDate(brand.createdAt || brand.created_at)}</p></div>
          <div><p>Actualizado</p><p className="text-gray-700">{fmtDate(brand.updatedAt || brand.updated_at)}</p></div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
          {hasPermission?.('brands.update') && brand.is_active && (
            <Button onClick={onEdit} className="flex-1">
              <PencilSimple className="h-4 w-4" /> Editar
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default BrandViewSheet;
