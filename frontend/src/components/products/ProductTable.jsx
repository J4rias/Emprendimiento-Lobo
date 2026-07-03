import { Eye, Edit, Trash2, Image as ImageIcon, Package } from 'lucide-react';
import { Button, Badge, EmptyState, SkeletonTable, Pagination } from '../ui';
import { formatMoney } from '../../utils/formatUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = API_URL.replace(/\/api$/, '');

const ProductTable = ({
  products,
  loading,
  calculateStockAndValue,
  hasPermission,
  onView,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}) => {
  const hasActions = hasPermission('products.update') || hasPermission('products.delete');
  const colCount = hasActions ? 8 : 7;

  return (
    <div className="card overflow-hidden">
      {!loading && products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No se encontraron productos"
          description="Ajusta los filtros o crea un nuevo producto"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="text-center">Stock (Bultos / Unid)</th>
                <th>Estado</th>
                <th className="text-center">Actualizado</th>
                <th className="text-right">Valor Inventario (COP)</th>
                {hasActions && <th className="text-center">Acciones</th>}
              </tr>
            </thead>
            {loading ? (
              <SkeletonTable rows={8} columns={colCount} />
            ) : (
              <tbody>
                {products.map((product) => {
                  const { bultos, unidades, unitsPerPackage, totalValueCOP } =
                    calculateStockAndValue(product);
                  return (
                    <tr key={product.id}>
                      <td>
                        {product.image_url ? (
                          <img
                            src={`${API_BASE_URL}${product.image_url}`}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded shadow-sm border border-gray-100"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-50 rounded flex items-center justify-center border border-gray-100">
                            <ImageIcon className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 leading-tight">{product.name}</span>
                          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter mt-0.5">
                            {product.sku}
                          </span>
                        </div>
                      </td>

                      <td>
                        {product.category ? (
                          <span
                            className="px-2 py-0.5 text-[10px] rounded-md text-white font-bold uppercase tracking-wider"
                            style={{ backgroundColor: product.category.color || '#6B7280' }}
                          >
                            {product.category.name}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] rounded-md bg-gray-100 text-gray-400 uppercase font-bold">
                            N/A
                          </span>
                        )}
                      </td>

                      <td className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-gray-800">
                            {bultos}{' '}
                            <span className="text-[10px] text-gray-500 font-normal uppercase">Bultos</span>
                          </span>
                          {unitsPerPackage > 1 && (
                            <span className="text-[11px] text-gray-500 italic">
                              + {unidades} <span className="text-[9px] uppercase">Unid</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <Badge variant={product.is_active ? 'success' : 'error'}>
                          {product.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>

                      <td className="text-center">
                        {product.updated_at ? (
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-gray-700 capitalize">
                              {new Date(product.updated_at).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(product.updated_at).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="text-right">
                        <span className="text-sm font-black text-slate-900">
                          {formatMoney(totalValueCOP, '$', 0)}
                          <span className="text-[10px] text-gray-400 ml-1 font-normal">COP</span>
                        </span>
                      </td>

                      {hasActions && (
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => onView(product)}
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {hasPermission('products.update') && product.is_active && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => onEdit(product)}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {hasPermission('products.delete') && product.is_active && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => onDelete(product.id)}
                                title="Eliminar"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
        />
      )}
    </div>
  );
};

export default ProductTable;
