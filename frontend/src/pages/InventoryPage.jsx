import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import DataTable from '../components/common/DataTable';
import { Package, AlertTriangle, Calendar, DollarSign, Search } from 'lucide-react';

const InventoryPage = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState(1); // Default to warehouse 1
  const [searchTerm, setSearchTerm] = useState('');

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', selectedWarehouse, searchTerm],
    queryFn: () =>
      inventoryService.getByWarehouse(selectedWarehouse, {
        search: searchTerm,
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

  const columns = [
    {
      header: 'SKU',
      accessor: 'product.sku',
      render: (value) => <span className="font-mono text-sm">{value}</span>,
    },
    {
      header: 'Producto',
      accessor: 'product.name',
    },
    {
      header: 'Categoría',
      accessor: 'product.category.name',
      render: (value) => (
        <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded-full">
          {value}
        </span>
      ),
    },
    {
      header: 'Cantidad',
      accessor: 'quantity',
      render: (value, row) => (
        <div>
          <span className="font-semibold">{parseFloat(value).toFixed(2)}</span>
          <span className="text-xs text-gray-500 ml-1">
            {row.product.unit_of_measure}
          </span>
        </div>
      ),
    },
    {
      header: 'Disponible',
      accessor: 'available_quantity',
      render: (value) => (
        <span className="text-green-600 font-medium">
          {parseFloat(value).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Estado',
      accessor: 'quantity',
      render: (value, row) => {
        const quantity = parseFloat(value);
        const reorderPoint = parseFloat(row.product.reorder_point);

        if (quantity <= reorderPoint) {
          return (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              Stock Bajo
            </span>
          );
        }
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
            Normal
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestión y control de inventario por depósito
        </p>
      </div>

      {/* Alerts Summary */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-red-800">Stock Bajo</p>
              <p className="text-2xl font-bold text-red-900">
                {lowStockData?.count || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Por Vencer</p>
              <p className="text-2xl font-bold text-yellow-900">
                {expiringData?.count || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-800">Total Items</p>
              <p className="text-2xl font-bold text-blue-900">
                {inventoryData?.pagination?.total || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Depósito
            </label>
            <select
              className="input"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(Number(e.target.value))}
            >
              <option value={1}>Depósito Principal</option>
              <option value={2}>Sucursal 1</option>
              <option value={3}>Sucursal 2</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                className="input pl-10"
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando inventario...</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={inventoryData?.data || []}
          />
        )}
      </div>
    </div>
  );
};

export default InventoryPage;
