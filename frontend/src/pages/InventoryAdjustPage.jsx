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
  
  const [presentations, setPresentations] = useState([]);
  const [selectedPresentation, setSelectedPresentation] = useState(null);
  const [packageQuantity, setPackageQuantity] = useState(0);
  const [looseUnits, setLooseUnits] = useState(0);
  const [documentNumber, setDocumentNumber] = useState('');

  const [formData, setFormData] = useState({
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

      // Load presentations
      if (response.data?.product?.presentations) {
        setPresentations(response.data.product.presentations);
        // Select default presentation
        const defaultPres = response.data.product.presentations.find(p => p.is_default);
        if (defaultPres) setSelectedPresentation(defaultPres.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar detalles del inventario');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalUnits = () => {
    const presentation = presentations.find(p => p.id === selectedPresentation);
    const unitsPerPackage = presentation?.units_per_package || 1;
    const packageUnits = packageQuantity * unitsPerPackage;
    return packageUnits + parseFloat(looseUnits || 0);
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
        presentation_id: selectedPresentation || null,
        package_quantity: packageQuantity,
        loose_units: looseUnits,
        type: formData.type,
        reason: formData.reason || `Ajuste manual por ${user?.name || 'Usuario'}`,
        document_number: documentNumber
      };

      await inventoryService.adjustInventory(adjustmentData);

      setSuccess('Stock ajustado exitosamente');

      // Refresh inventory data
      await fetchInventoryDetail();

      // Reset form
      setPackageQuantity(0);
      setLooseUnits(0);
      setDocumentNumber('');
      setFormData(prev => ({
        ...prev,
        reason: ''
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Error al ajustar el stock');
    } finally {
      setSubmitting(false);
    }
  };

  const totalUnits = calculateTotalUnits();

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

          {/* Presentation Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Empaque
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={selectedPresentation || ''}
              onChange={(e) => setSelectedPresentation(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Sin presentación (unidades sueltas)</option>
              {presentations.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.units_per_package} unidades)
                </option>
              ))}
            </select>
          </div>

          {/* Package Quantity */}
          {selectedPresentation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad de {presentations.find(p => p.id === selectedPresentation)?.name || 'Paquetes'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPackageQuantity(Math.max(0, packageQuantity - 1))}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center"
                  value={packageQuantity}
                  onChange={(e) => setPackageQuantity(parseInt(e.target.value) || 0)}
                  min="0"
                />
                <button
                  type="button"
                  onClick={() => setPackageQuantity(packageQuantity + 1)}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Loose Units */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unidades Sueltas {selectedPresentation ? '(adicionales)' : ''}
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={looseUnits}
              onChange={(e) => setLooseUnits(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
            />
          </div>

          {/* Total Calculated */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium">Total en Unidades Base:</p>
            <p className="text-2xl font-bold text-blue-600">
              {totalUnits.toFixed(2)} unidades
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Nuevo stock: <span className="font-medium">
                {formData.type === 'add'
                  ? (parseFloat(inventory.quantity) + totalUnits).toFixed(2)
                  : Math.max(0, parseFloat(inventory.quantity) - totalUnits).toFixed(2)
                } unidades
              </span>
            </p>
          </div>

          {/* Document Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Documento (Opcional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Ej: FAC-12345, REM-789"
            />
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
              disabled={submitting || totalUnits === 0}
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
