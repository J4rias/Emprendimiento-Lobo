import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import { Package, TrendingUp, TrendingDown, Filter, FileText } from 'lucide-react';

const InventoryMovementsPage = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    movement_type: '',
    date_from: '',
    date_to: ''
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', filters, page],
    queryFn: () => inventoryService.getMovements({ ...filters, page })
  });

  const pagination = data?.pagination || {};
  const totalPages = pagination.pages || 1;

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const getMovementIcon = (type) => {
    switch (type) {
      case 'ingreso':
      case 'ajuste_positivo':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'egreso':
      case 'ajuste_negativo':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      default:
        return <Package className="w-5 h-5 text-gray-600" />;
    }
  };

  const getMovementColor = (type) => {
    switch (type) {
      case 'ingreso':
      case 'ajuste_positivo':
        return 'bg-green-100 text-green-800';
      case 'egreso':
      case 'ajuste_negativo':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMovementLabel = (type) => {
    const labels = {
      'ingreso': 'Ingreso',
      'egreso': 'Egreso',
      'ajuste_positivo': 'Ajuste Positivo',
      'ajuste_negativo': 'Ajuste Negativo',
      'transferencia': 'Transferencia'
    };
    return labels[type] || type;
  };

  const getUserName = (user) => {
    if (!user) return '-';
    if (user.first_name) return `${user.first_name} ${user.last_name || ''}`.trim();
    return user.username || '-';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando movimientos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Movimientos</h1>
          <p className="text-gray-600">Registro de todos los movimientos de inventario</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="h-4 w-4 inline mr-1" />
              Tipo de Movimiento
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={filters.movement_type}
              onChange={(e) => handleFilterChange({ ...filters, movement_type: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
              <option value="ajuste_positivo">Ajuste Positivo</option>
              <option value="ajuste_negativo">Ajuste Negativo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Desde</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={filters.date_from}
              onChange={(e) => handleFilterChange({ ...filters, date_from: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hasta</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={filters.date_to}
              onChange={(e) => handleFilterChange({ ...filters, date_to: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Almacén</th>
                <th>Tipo</th>
                <th>Presentación</th>
                <th className="text-center">Paquetes</th>
                <th className="text-center">Sueltas</th>
                <th className="text-center">Total</th>
                <th>Usuario</th>
                <th>Documento</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron movimientos</p>
                  </td>
                </tr>
              ) : (
                data?.data?.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap">
                      <div>
                        <p className="font-medium">
                          {new Date(movement.created_at).toLocaleDateString('es-ES')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(movement.created_at).toLocaleTimeString('es-ES')}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{movement.product?.name}</p>
                        <p className="text-xs text-gray-500">{movement.product?.sku}</p>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-gray-600">{movement.warehouse?.name || '-'}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {getMovementIcon(movement.movement_type)}
                        <span className={`px-2 py-1 text-xs rounded-full ${getMovementColor(movement.movement_type)}`}>
                          {getMovementLabel(movement.movement_type)}
                        </span>
                      </div>
                    </td>
                    <td>
                      {movement.presentation?.name || (
                        <span className="text-gray-500 italic text-sm">Sin presentación</span>
                      )}
                    </td>
                    <td className="text-center">
                      {movement.package_quantity ? (
                        <span className="font-medium">{movement.package_quantity}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      {movement.loose_units > 0 ? (
                        <span className="font-medium">{movement.loose_units}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="font-semibold text-blue-600">
                        {parseFloat(movement.quantity).toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm">{getUserName(movement.user)}</span>
                    </td>
                    <td>
                      {movement.document_number ? (
                        <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {movement.document_number}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>
                      <span className="text-sm text-gray-600">
                        {movement.reason
                          ? (movement.reason.length > 50 ? movement.reason.slice(0, 50) + '…' : movement.reason)
                          : <span className="text-gray-400">-</span>
                        }
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando página {pagination.page} de {totalPages} ({pagination.total} movimientos)
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryMovementsPage;
