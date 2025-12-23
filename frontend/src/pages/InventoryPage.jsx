import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import { Package, AlertTriangle, Calendar, DollarSign, Search, Filter, Download, RefreshCw, Eye, Edit, Plus, Minus, HelpCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InventoryPage = () => {
  const navigate = useNavigate();
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    lowStock: false,
    expiring: false,
    outOfStock: false
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const [showHelp, setShowHelp] = useState(false);

  const { data: inventoryData, isLoading, refetch } = useQuery({
    queryKey: ['inventory', selectedWarehouse, searchTerm, filters],
    queryFn: () =>
      inventoryService.getByWarehouse(selectedWarehouse, {
        search: searchTerm,
        low_stock: filters.lowStock,
        expiring: filters.expiring,
        out_of_stock: filters.outOfStock,
      }),
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['lowStock'],
    queryFn: () => inventoryService.getLowStock(),
  });

  const { data: expiringData } = useQuery({
    queryKey: ['expiring'],
    queryFn: () => inventoryService.getExpiringProducts({ days: 30 }),
  });

  const { data: valuationData } = useQuery({
    queryKey: ['valuation'],
    queryFn: () => inventoryService.getValuation({ warehouse_id: selectedWarehouse }),
  });

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === inventoryData?.data?.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(inventoryData?.data?.map(item => item.id) || []);
    }
  };

  const getStockStatus = (quantity, reorderPoint) => {
    const qty = parseFloat(quantity);
    const point = parseFloat(reorderPoint);
    
    if (qty === 0) {
      return { text: 'Agotado', className: 'px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full' };
    } else if (qty <= point) {
      return { text: 'Stock Bajo', className: 'px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full' };
    }
    return { text: 'Normal', className: 'px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full' };
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-blue-600 hover:text-blue-800"
              title="Ayuda"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Gestión y control de inventario por depósito
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          <button
            onClick={() => navigate('/productos?action=new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">¿Cómo funciona el inventario?</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p><strong>📦 Stock Actual:</strong> Cantidad física disponible de cada producto en el depósito seleccionado.</p>
                <p><strong>⚠️ Stock Bajo:</strong> Productos que están en o por debajo del punto de reorden configurado.</p>
                <p><strong>🔴 Agotado:</strong> Productos sin stock disponible que necesitan reabastecimiento urgente.</p>
                <p><strong>💰 Valor Total:</strong> Suma del costo de todos los productos en inventario.</p>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="font-medium mb-1">Acciones disponibles:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Click en el ojo (👁️) para ver detalles del producto</li>
                    <li>Click en el lápiz (✏️) para ajustar el stock (agregar o remover)</li>
                    <li>Selecciona múltiples productos para transferencias masivas</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Cerrar ayuda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div 
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setFilters({ ...filters, lowStock: !filters.lowStock })}
          title="Click para filtrar productos con stock bajo"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-red-600">
                {lowStockData?.data?.length || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Click para filtrar</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div 
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setFilters({ ...filters, expiring: !filters.expiring })}
          title="Click para filtrar productos próximos a vencer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Por Vencer</p>
              <p className="text-2xl font-bold text-yellow-600">
                {expiringData?.data?.length || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Próximos 30 días</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-blue-600">
                {inventoryData?.pagination?.total || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-green-600">
                ${valuationData?.data?.totalValue?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              <option value="all">Todos los Depósitos</option>
              <option value={1}>Depósito Principal</option>
              <option value={2}>Sucursal 1</option>
              <option value={3}>Sucursal 2</option>
            </select>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filtros
              {(filters.lowStock || filters.expiring || filters.outOfStock) && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {Object.keys(filters).filter(k => filters[k]).length}
                </span>
              )}
            </button>

            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.lowStock}
                  onChange={(e) => setFilters({ ...filters, lowStock: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Stock Bajo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.expiring}
                  onChange={(e) => setFilters({ ...filters, expiring: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Próximos a vencer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.outOfStock}
                  onChange={(e) => setFilters({ ...filters, outOfStock: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Agotados</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600">Cargando inventario...</p>
          </div>
        ) : (
          <>
            {/* Table Header with Selection */}
            {selectedItems.length > 0 && (
              <div className="bg-blue-50 px-6 py-3 border-b border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-800">
                    {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} seleccionado{selectedItems.length > 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 bg-white border border-blue-300 text-blue-700 rounded text-sm hover:bg-blue-50">
                      Ajustar Stock
                    </button>
                    <button className="px-3 py-1 bg-white border border-blue-300 text-blue-700 rounded text-sm hover:bg-blue-50">
                      Transferir
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === inventoryData?.data?.length}
                        onChange={handleSelectAll}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Actual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Mínimo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventoryData?.data?.map((item) => {
                    const status = getStockStatus(item.quantity, item.product.reorder_point);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.product.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {item.product.presentations?.[0]?.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono text-gray-900">
                            {item.product.sku}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded-full">
                            {item.product.category?.name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {parseFloat(item.quantity).toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {item.product.unit_of_measure}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {item.product.reorder_point || '0'} {item.product.unit_of_measure}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={status.className}>
                            {status.text}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/inventario/${item.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/inventario/${item.id}/adjust`)}
                              className="text-green-600 hover:text-green-800"
                              title="Ajustar stock"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {!isLoading && (!inventoryData?.data || inventoryData.data.length === 0) && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos en el inventario</h3>
                <p className="text-gray-500 mb-4">Comienza agregando productos para gestionar tu inventario</p>
                <div className="flex flex-col items-center gap-2 text-sm text-gray-600">
                  <p>Para agregar inventario:</p>
                  <ol className="list-decimal list-inside text-left space-y-1">
                    <li>Crea productos en la sección "Productos"</li>
                    <li>El inventario se creará automáticamente</li>
                    <li>Ajusta las cantidades según tu stock físico</li>
                  </ol>
                </div>
                <button
                  onClick={() => navigate('/productos?action=new')}
                  className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Crear Primer Producto
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InventoryPage;
