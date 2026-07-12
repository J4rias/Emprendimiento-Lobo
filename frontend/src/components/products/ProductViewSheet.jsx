import { PencilSimple, Image as ImageIcon, Package, CurrencyDollar, Star } from '@phosphor-icons/react';
import { Sheet, Badge, Button } from '../ui';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || window.location.origin;

const formatDate = (date) => {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

const ProductViewSheet = ({ open, onClose, product, onEdit, hasPermission }) => {
  if (!product) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Detalles del Producto" size="xl">
      {/* Image */}
      <div className="mb-4">
        {product.image_url ? (
          <img
            src={`${API_BASE_URL}${product.image_url}`}
            alt={product.name}
            className="w-full h-auto max-h-72 object-contain rounded-lg border border-gray-200 bg-gray-50"
          />
        ) : (
          <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
            <ImageIcon className="h-12 w-12 text-gray-300" />
          </div>
        )}
      </div>

      {/* Name + status */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
          <p className="text-xs font-mono text-gray-400 uppercase">{product.sku}</p>
        </div>
        <Badge variant={product.is_active ? 'success' : 'error'} className="shrink-0">
          {product.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Basic Info */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Información Básica</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Código de Barras</p>
              <p className="font-mono text-gray-900">{product.barcodes?.[0]?.barcode || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Categoría</p>
              {product.category ? (
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: product.category.color || '#6B7280' }}
                  />
                  <span className="text-gray-900">{product.category.name}</span>
                </div>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Marca</p>
              <p className="text-gray-900">{product.brand?.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Tamaño de Unidad</p>
              <p className="text-gray-900">
                {product.unit_size
                  ? `${parseFloat(product.unit_size) % 1 === 0 ? parseInt(product.unit_size) : parseFloat(product.unit_size).toFixed(1)} ${product.unit_size_measure || 'UND'}`
                  : '-'}
              </p>
            </div>
            {product.description && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Descripción</p>
                <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
              </div>
            )}
          </div>
        </section>

        {/* Presentations */}
        {product.presentations && product.presentations.length > 0 && (
          <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Presentaciones ({product.presentations.length})
            </h4>
            <div className="space-y-3">
              {product.presentations.map((pres, i) => (
                <div
                  key={pres.id || i}
                  className={`text-sm ${i > 0 ? 'pt-3 border-t border-gray-200' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{pres.name || 'Sin nombre'}</span>
                    {pres.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                        <Star className="h-3 w-3 fill-current" />
                        Predeterminada
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Tipo empaque: </span>
                      <span className="text-gray-900">{pres.packagingType?.name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tipo presentación: </span>
                      <span className="text-gray-900">{pres.presentationType?.name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Unidades/paquete: </span>
                      <span className="text-gray-900 font-medium">{pres.units_per_package}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Moneda: </span>
                      <span className="text-gray-900">{pres.purchase_currency || 'USD'}</span>
                    </div>
                  </div>
                  <div className="bg-white rounded p-2 border border-gray-200 mt-2 flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <CurrencyDollar className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-500">Precio: </span>
                      <span className="font-semibold text-gray-900">
                        ${parseFloat(pres.package_price || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Costo: </span>
                      <span className="text-gray-900">
                        ${parseFloat(pres.package_cost || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stock Config */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Configuración de Stock</h4>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Mínimo</p>
              <p className="font-medium text-gray-900">{product.min_stock ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Máximo</p>
              <p className="font-medium text-gray-900">{product.max_stock ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Punto Reorden</p>
              <p className="font-medium text-gray-900">{product.reorder_point ?? '-'}</p>
            </div>
          </div>
        </section>

        {/* Additional Config */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Configuración Adicional</h4>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2 text-gray-700">
              <input type="checkbox" checked={!!product.is_perishable} disabled readOnly className="rounded border-gray-300" />
              Producto Perecedero
            </label>
            <label className="flex items-center gap-2 text-gray-700">
              <input type="checkbox" checked={!!product.has_batch_control} disabled readOnly className="rounded border-gray-300" />
              Control por Lote
            </label>
          </div>
        </section>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
          <div>
            <p>Creado</p>
            <p className="text-gray-700">{formatDate(product.createdAt || product.created_at)}</p>
          </div>
          <div>
            <p>Actualizado</p>
            <p className="text-gray-700">{formatDate(product.updatedAt || product.updated_at)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 pb-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cerrar
          </Button>
          {hasPermission('products.update') && product.is_active && (
            <Button onClick={onEdit} className="flex-1">
              <PencilSimple className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default ProductViewSheet;
