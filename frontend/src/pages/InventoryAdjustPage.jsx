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
        ...(selectedPresentation && { presentation_id: selectedPresentation }),
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
              Presentación del Producto *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedPresentation || ''}
              onChange={(e) => setSelectedPresentation(e.target.value ? parseInt(e.target.value) : null)}
              required
            >
              <option value="">Seleccionar presentación</option>
              {presentations.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - {p.units_per_package} uds/paquete
                  {parseFloat(p.package_price || 0) > 0 ? ` - $${parseFloat(p.package_price).toFixed(2)}` : ''}
                  {p.is_default ? ' (Predeterminada)' : ''}
                </option>
              ))}
            </select>

            {/* Visual indicator for selected presentation */}
            {selectedPresentation && (() => {
              const selectedPres = presentations.find(p => p.id === selectedPresentation);
              return selectedPres && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Detalles de la Presentación</span>
                  </div>
                  <div className="ml-6 space-y-1 text-xs">
                    <p>📦 Cada paquete contiene: <span className="font-semibold">{selectedPres.units_per_package} unidades</span></p>
                    {parseFloat(selectedPres.package_cost || 0) > 0 && (
                      <p>💰 Costo/paquete: <span className="font-semibold">${parseFloat(selectedPres.package_cost).toFixed(2)} {selectedPres.purchase_currency || 'USD'}</span></p>
                    )}
                    {parseFloat(selectedPres.package_price || 0) > 0 && (
                      <p>💵 Precio/paquete: <span className="font-semibold">${parseFloat(selectedPres.package_price).toFixed(2)}</span></p>
                    )}
                    {parseFloat(selectedPres.cost || 0) > 0 && (
                      <p>💲 Costo/unidad: <span className="font-semibold">${parseFloat(selectedPres.cost).toFixed(2)}</span></p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Package Quantity */}
          {selectedPresentation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad de Paquetes
                {(() => {
                  const selectedPres = presentations.find(p => p.id === selectedPresentation);
                  return selectedPres && (
                    <span className="text-xs text-gray-500 ml-1">
                      ({selectedPres.units_per_package} uds/paquete)
                    </span>
                  );
                })()}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPackageQuantity(Math.max(0, packageQuantity - 1))}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  disabled={packageQuantity === 0}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={packageQuantity}
                  onChange={(e) => setPackageQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                  step="1"
                />
                <button
                  type="button"
                  onClick={() => setPackageQuantity(packageQuantity + 1)}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  {packageQuantity} {packageQuantity === 1 ? 'paquete' : 'paquetes'}
                </span>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={looseUnits}
              onChange={(e) => setLooseUnits(Math.max(0, parseFloat(e.target.value) || 0))}
              min="0"
              step="1"
            />
            <p className="mt-1 text-xs text-gray-500">
              Ingresa la cantidad de unidades individuales
            </p>
          </div>

          {/* Total Calculated */}
          {(packageQuantity > 0 || looseUnits > 0) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-blue-900 font-semibold mb-2">Resumen del Ajuste:</p>

                  {/* Calculation breakdown */}
                  <div className="space-y-1 text-xs text-gray-700 mb-3">
                    {selectedPresentation && packageQuantity > 0 && (() => {
                      const selectedPres = presentations.find(p => p.id === selectedPresentation);
                      const pkgUnits = packageQuantity * (selectedPres?.units_per_package || 1);
                      return (
                        <p>
                          📦 {packageQuantity} {packageQuantity === 1 ? 'paquete' : 'paquetes'} × {selectedPres?.units_per_package} uds = <span className="font-semibold">{pkgUnits} unidades</span>
                        </p>
                      );
                    })()}
                    {looseUnits > 0 && (
                      <p>➕ {looseUnits} {looseUnits === 1 ? 'unidad suelta' : 'unidades sueltas'}</p>
                    )}
                  </div>

                  {/* Total */}
                  <div className="border-t border-blue-300 pt-2">
                    <p className="text-sm text-blue-900 font-medium">
                      Total a {formData.type === 'add' ? 'agregar' : 'quitar'}:
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {Math.floor(totalUnits)} unidades
                    </p>
                  </div>

                  {/* New stock preview */}
                  <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                    <p className="text-xs text-gray-600">
                      Stock actual: <span className="font-semibold">{Math.floor(inventory.quantity)} uds</span>
                    </p>
                    <p className="text-sm text-gray-900 font-semibold">
                      Nuevo stock: <span className={formData.type === 'add' ? 'text-green-600' : 'text-orange-600'}>
                        {formData.type === 'add'
                          ? Math.floor(parseFloat(inventory.quantity) + totalUnits)
                          : Math.max(0, Math.floor(parseFloat(inventory.quantity) - totalUnits))
                        } uds
                      </span>
                      {formData.type === 'add' ? ' ↗' : ' ↘'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate(`/inventario/${id}`)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || totalUnits === 0 || !selectedPresentation}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirmar Ajuste {formData.type === 'add' ? '(Agregar)' : '(Quitar)'}
                </>
              )}
            </button>
          </div>

          {/* Validation warnings */}
          {!selectedPresentation && (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>Debes seleccionar una presentación para continuar</p>
            </div>
          )}
          {totalUnits === 0 && selectedPresentation && (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>Debes ingresar al menos un paquete o una unidad suelta</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default InventoryAdjustPage;
