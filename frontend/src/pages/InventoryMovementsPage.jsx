import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import { Package, TrendingUp, TrendingDown, Filter, FileText } from 'lucide-react';

const InventoryMovementsPage = () => {
  const [filters, setFilters] = useState({
    movement_type: '',
    start_date: '',
    end_date: ''
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', filters],
    queryFn: () => inventoryService.getMovements(filters)
  });

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
              onChange={(e) => setFilters({ ...filters, movement_type: e.target.value })}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Desde
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hasta
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
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
                <th>Tipo</th>
                <th>Presentación</th>
                <th className="text-center">Paquetes</th>
                <th className="text-center">Sueltas</th>
                <th className="text-center">Total</th>
                <th>Usuario</th>
                <th>Documento</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-500">
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
                      <span className="text-sm">{movement.user?.name}</span>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination info */}
      {data?.pagination && (
        <div className="card">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>
              Mostrando {data.data.length} de {data.pagination.total} movimientos
            </p>
            <p>
              Página {data.pagination.page} de {data.pagination.pages}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryMovementsPage;
