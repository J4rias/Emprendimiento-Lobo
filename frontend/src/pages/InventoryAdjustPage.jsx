import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryService } from '../services/api/inventoryService';
import { ArrowLeft, Package, Plus, Minus, AlertCircle, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const InventoryAdjustPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [formData, setFormData] = useState({
    quantity: 0,
    type: 'add',
    reason: ''
  });

  useEffect(() => {
    fetchInventoryDetail();
  }, [id]);

  const fetchInventoryDetail = async () => {
    try {
      const response = await inventoryService.getById(id);
      setInventory(response.data);
      setFormData(prev => ({
        ...prev,
        quantity: 0
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar detalles del inventario');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const adjustmentData = {
        product_id: inventory.product.id,
        warehouse_id: inventory.warehouse_id,
        quantity: formData.quantity,
        type: formData.type,
        reason: formData.reason || `Ajuste manual por ${user?.name || 'Usuario'}`
      };

      await inventoryService.adjustInventory(adjustmentData);
      
      setSuccess('Stock ajustado exitosamente');
      
      // Refresh inventory data
      await fetchInventoryDetail();
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        quantity: 0,
        reason: ''
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Error al ajustar el stock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuantityChange = (delta) => {
    const newQuantity = formData.quantity + delta;
    const maxValue = formData.type === 'remove' ? parseFloat(inventory.quantity) : Infinity;
    const clampedQuantity = Math.max(0, Math.min(newQuantity, maxValue));
    setFormData(prev => ({
      ...prev,
      quantity: clampedQuantity
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error && !inventory) {
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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/inventario/${id}`)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ajustar Stock</h1>
          <p className="text-gray-600">Ajustar la cantidad de producto en inventario</p>
        </div>
      </div>

      {/* Product Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Producto</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Nombre</p>
            <p className="font-medium">{inventory.product.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">SKU</p>
            <p className="font-medium">{inventory.product.sku}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Stock Actual</p>
            <p className="font-medium text-lg">{Math.floor(inventory.quantity)}</p>
          </div>
        </div>
      </div>

      {/* Adjustment Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ajuste de Stock</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 flex items-start gap-3">
            <Check className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Éxito</p>
              <p className="text-sm">{success}</p>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Ajuste
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="add"
                  checked={formData.type === 'add'}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="mr-2"
                />
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-600" />
                  Agregar Stock
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="remove"
                  checked={formData.type === 'remove'}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="mr-2"
                />
                <span className="flex items-center gap-2">
                  <Minus className="w-4 h-4 text-red-600" />
                  Quitar Stock
                </span>
              </label>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad a {formData.type === 'add' ? 'Agregar' : 'Quitar'}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleQuantityChange(-1)}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min="0"
                max={formData.type === 'remove' ? inventory.quantity : undefined}
                value={formData.quantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  const maxValue = formData.type === 'remove' ? parseFloat(inventory.quantity) : Infinity;
                  setFormData(prev => ({ 
                    ...prev, 
                    quantity: Math.max(0, Math.min(value, maxValue))
                  }));
                }}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center"
                required
              />
              <button
                type="button"
                onClick={() => handleQuantityChange(1)}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Nuevo stock: <span className="font-medium">
                {formData.type === 'add' 
                  ? parseFloat(inventory.quantity) + parseFloat(formData.quantity) 
                  : Math.max(0, parseFloat(inventory.quantity) - parseFloat(formData.quantity))
                }
              </span>
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo del Ajuste
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Describe el motivo del ajuste..."
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(`/inventario/${id}`)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || formData.quantity === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Procesando...' : 'Confirmar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAdjustPage;
