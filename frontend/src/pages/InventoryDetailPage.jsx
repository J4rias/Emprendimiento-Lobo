import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryService } from '../services/api/inventoryService';
import { ArrowLeft, Package, Calendar, DollarSign, AlertTriangle, Warehouse, Edit } from 'lucide-react';

const InventoryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInventoryDetail();
  }, [id]);

  const fetchInventoryDetail = async () => {
    try {
      const response = await inventoryService.getById(id);
      setInventory(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar detalles del inventario');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  if (error || !inventory) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inventario')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detalles del Inventario</h1>
            <p className="text-gray-600">Información detallada del producto en inventario</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/inventario/${id}/adjust`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Ajustar Stock
        </button>
      </div>

      {/* Product Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información del Producto</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600">Nombre del Producto</p>
            <p className="font-medium">{inventory.product.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">SKU</p>
            <p className="font-medium">{inventory.product.sku}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Categoría</p>
            <p className="font-medium">{inventory.product.category?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Marca</p>
            <p className="font-medium">{inventory.product.brand || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Unidad de Medida</p>
            <p className="font-medium">{inventory.product.unit_of_measure}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Depósito</p>
            <p className="font-medium flex items-center gap-2">
              <Warehouse className="w-4 h-4" />
              {inventory.warehouse?.name || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Stock Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de Stock</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Stock Actual</p>
            <p className="text-2xl font-bold text-blue-600">{Math.floor(inventory.quantity)}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Valor Unitario</p>
            <p className="text-2xl font-bold text-green-600">
              ${inventory.product.presentations?.[0]?.cost || '0.00'}
            </p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Punto de Pedido</p>
            <p className="text-2xl font-bold text-yellow-600">{Math.floor(inventory.product.reorder_point)}</p>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Última Actualización</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(inventory.updated_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Estado</p>
              <p className="font-medium">
                {inventory.quantity === 0 ? (
                  <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                    Agotado
                  </span>
                ) : inventory.quantity <= inventory.product.reorder_point ? (
                  <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                    Stock Bajo
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Normal
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryDetailPage;
