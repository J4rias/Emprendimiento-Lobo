import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, Package, Plus, Minus, Check, X, ArrowLeft, Warehouse, AlertCircle, Camera, Keyboard } from 'lucide-react';
import { productService } from '../services/api/productService';
import { inventoryService } from '../services/api/inventoryService';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerComponent } from '../components/BarcodeScanner';

const StockReplenishmentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);
  
  const [barcode, setBarcode] = useState('');
  const [product, setProduct] = useState(null);
  const [warehouseId, setWarehouseId] = useState(1);
  const [presentations, setPresentations] = useState([]);
  const [selectedPresentation, setSelectedPresentation] = useState(null);
  const [packageQuantity, setPackageQuantity] = useState(0);
  const [looseUnits, setLooseUnits] = useState(0);
  const [warehouses, setWarehouses] = useState([
    { id: 1, name: 'Depósito Principal' },
    { id: 2, name: 'Sucursal 1' },
    { id: 3, name: 'Sucursal 2' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [history, setHistory] = useState([]);
  const [scanMode, setScanMode] = useState(true);
  const [useCameraScanner, setUseCameraScanner] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    // Auto-focus input when component mounts or after successful scan
    if (inputRef.current && scanMode) {
      inputRef.current.focus();
    }
  }, [scanMode, success]);

  const handleBarcodeInput = async (e) => {
    const value = e.target.value;
    setBarcode(value);

    // Auto-submit when Enter is pressed or barcode length is sufficient
    if (e.key === 'Enter' && value.trim()) {
      await searchProduct(value.trim());
    }
  };

  const searchProduct = async (code) => {
    if (!code || code.trim() === '') return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await productService.searchByBarcode(code);

      if (response.data) {
        setProduct(response.data);

        // Load presentations
        if (response.data.presentations && response.data.presentations.length > 0) {
          setPresentations(response.data.presentations);
          // Select default presentation
          const defaultPres = response.data.presentations.find(p => p.is_default);
          if (defaultPres) {
            setSelectedPresentation(defaultPres.id);
          } else {
            setSelectedPresentation(response.data.presentations[0].id);
          }
        }

        setScanMode(false);
        setBarcode('');
      } else {
        setError('Producto no encontrado. Verifica el código de barras.');
        setBarcode('');
        // Vibrate on error if available
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al buscar el producto');
      setBarcode('');
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeDetected = (result) => {
    if (result && !loading && scanMode) {
      // Vibrate on successful scan
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      searchProduct(result);
    }
  };

  const calculateTotalUnits = () => {
    const presentation = presentations.find(p => p.id === selectedPresentation);
    const unitsPerPackage = presentation?.units_per_package || 1;
    const packageUnits = packageQuantity * unitsPerPackage;
    return packageUnits + parseFloat(looseUnits || 0);
  };

  const handleReplenish = async () => {
    if (!product) return;

    const totalUnits = calculateTotalUnits();

    if (totalUnits === 0) {
      setError('Debes ingresar al menos un paquete o una unidad suelta');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await inventoryService.adjustInventory({
        product_id: product.id,
        warehouse_id: warehouseId,
        ...(selectedPresentation && { presentation_id: selectedPresentation }),
        package_quantity: packageQuantity,
        loose_units: looseUnits,
        type: 'add',
        reason: `Reposición de stock - Escáner móvil por ${user?.name || 'Usuario'}`
      });

      // Add to history
      const historyItem = {
        id: Date.now(),
        product: product.name,
        sku: product.sku,
        quantity: totalUnits,
        warehouse: warehouses.find(w => w.id === warehouseId)?.name,
        timestamp: new Date().toLocaleTimeString()
      };
      setHistory([historyItem, ...history.slice(0, 9)]); // Keep last 10

      setSuccess(`✓ ${Math.floor(totalUnits)} unidades agregadas correctamente`);

      // Reset for next scan
      setTimeout(() => {
        setProduct(null);
        setPresentations([]);
        setSelectedPresentation(null);
        setPackageQuantity(0);
        setLooseUnits(0);
        setScanMode(true);
        setSuccess(null);
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.message || 'Error al reponer el stock');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setProduct(null);
    setBarcode('');
    setPresentations([]);
    setSelectedPresentation(null);
    setPackageQuantity(0);
    setLooseUnits(0);
    setScanMode(true);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header - Fixed */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/inventario')}
            className="p-2 hover:bg-blue-700 rounded-lg"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Reposición de Stock</h1>
          <div className="w-10"></div>
        </div>
        
        {/* Warehouse Selector */}
        <div className="bg-blue-700 rounded-lg p-3">
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Warehouse className="w-4 h-4" />
            Depósito
          </label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(Number(e.target.value))}
            className="w-full px-4 py-3 bg-white text-gray-900 rounded-lg text-lg font-medium focus:ring-2 focus:ring-blue-300"
            disabled={!scanMode}
          >
            {warehouses.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Scanner Section */}
        {scanMode && (
          <div className="space-y-4">
            {/* Scanner Mode Toggle */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setUseCameraScanner(true)}
                  className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                    useCameraScanner
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Camera className="w-5 h-5" />
                  Cámara
                </button>
                <button
                  onClick={() => setUseCameraScanner(false)}
                  className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                    !useCameraScanner
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Keyboard className="w-5 h-5" />
                  Manual
                </button>
              </div>
            </div>

            {/* Camera Scanner */}
            {useCameraScanner ? (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Camera className="w-6 h-6" />
                    <h2 className="text-lg font-bold">Escaneo con Cámara</h2>
                  </div>
                  <p className="text-sm text-blue-100">
                    Apunta la cámara al código de barras
                  </p>
                </div>
                
                <div className="relative bg-black" style={{ minHeight: '300px' }}>
                  {cameraError ? (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                      <div>
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <p className="text-white mb-2">Error al acceder a la cámara</p>
                        <p className="text-gray-400 text-sm mb-4">{cameraError}</p>
                        <button
                          onClick={() => {
                            setCameraError(null);
                            setUseCameraScanner(false);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                        >
                          Usar entrada manual
                        </button>
                      </div>
                    </div>
                  ) : (
                    <BarcodeScannerComponent
                      onDetected={handleBarcodeDetected}
                      onError={(err) => setCameraError(err)}
                    />
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
                  <p>Mantén el código de barras dentro del marco</p>
                  <p className="text-xs mt-1">El escaneo es automático</p>
                </div>
              </div>
            ) : (
              /* Manual Input */
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                    <Scan className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Ingresa el Código de Barras
                  </h2>
                  <p className="text-gray-600">
                    Escribe o escanea con lector externo
                  </p>
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyPress={handleBarcodeInput}
                  placeholder="Código de barras..."
                  className="w-full px-4 py-4 text-xl text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />

                {barcode && (
                  <button
                    onClick={() => searchProduct(barcode)}
                    disabled={loading}
                    className="w-full mt-4 px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {loading ? 'Buscando...' : 'Buscar Producto'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Product Details & Quantity */}
        {!scanMode && product && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Product Info */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6">
              <div className="flex items-start gap-3">
                <Package className="w-8 h-8 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">{product.name}</h3>
                  <p className="text-green-100">SKU: {product.sku}</p>
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="p-6 space-y-4">
              {/* Presentation Selector */}
              {presentations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Presentación del Producto *
                  </label>
                  <select
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={selectedPresentation || ''}
                    onChange={(e) => setSelectedPresentation(e.target.value ? parseInt(e.target.value) : null)}
                    required
                  >
                    <option value="">Seleccionar presentación</option>
                    {presentations.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {p.units_per_package} uds/paquete
                        {parseFloat(p.package_price || 0) > 0 ? ` - $${parseFloat(p.package_price).toFixed(2)}` : ''}
                        {p.is_default ? ' ⭐' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                      className="w-14 h-14 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 flex items-center justify-center disabled:opacity-50"
                      disabled={packageQuantity === 0}
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    <input
                      type="number"
                      className="flex-1 text-center text-3xl font-bold py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                      value={packageQuantity}
                      onChange={(e) => setPackageQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                      min="0"
                      step="1"
                    />
                    <button
                      type="button"
                      onClick={() => setPackageQuantity(packageQuantity + 1)}
                      className="w-14 h-14 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 flex items-center justify-center"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-2 font-medium">
                    {packageQuantity} {packageQuantity === 1 ? 'paquete' : 'paquetes'}
                  </p>
                </div>
              )}

              {/* Loose Units */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unidades Sueltas {selectedPresentation ? '(adicionales)' : ''}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLooseUnits(Math.max(0, looseUnits - 1))}
                    className="w-14 h-14 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 flex items-center justify-center disabled:opacity-50"
                    disabled={looseUnits === 0}
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <input
                    type="number"
                    className="flex-1 text-center text-2xl font-semibold py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                    value={looseUnits}
                    onChange={(e) => setLooseUnits(Math.max(0, parseFloat(e.target.value) || 0))}
                    min="0"
                    step="1"
                  />
                  <button
                    type="button"
                    onClick={() => setLooseUnits(looseUnits + 1)}
                    className="w-14 h-14 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 flex items-center justify-center"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-center text-xs text-gray-500 mt-2">
                  Ingresa la cantidad de unidades individuales
                </p>
              </div>

              {/* Total Calculated */}
              {(packageQuantity > 0 || looseUnits > 0) && (() => {
                const totalUnits = calculateTotalUnits();
                return (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Package className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-green-900 font-bold mb-2">Resumen del Ajuste:</p>

                        {/* Calculation breakdown */}
                        <div className="space-y-1 text-sm text-gray-700 mb-3">
                          {selectedPresentation && packageQuantity > 0 && (() => {
                            const selectedPres = presentations.find(p => p.id === selectedPresentation);
                            const pkgUnits = packageQuantity * (selectedPres?.units_per_package || 1);
                            return (
                              <p className="font-medium">
                                📦 {packageQuantity} {packageQuantity === 1 ? 'paquete' : 'paquetes'} × {selectedPres?.units_per_package} uds = <span className="font-bold text-green-700">{pkgUnits} unidades</span>
                              </p>
                            );
                          })()}
                          {looseUnits > 0 && (
                            <p className="font-medium">➕ {looseUnits} {looseUnits === 1 ? 'unidad suelta' : 'unidades sueltas'}</p>
                          )}
                        </div>

                        {/* Total */}
                        <div className="border-t-2 border-green-300 pt-2">
                          <p className="text-sm text-green-900 font-bold">Total a agregar:</p>
                          <p className="text-3xl font-black text-green-600">
                            {Math.floor(totalUnits)} uds
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Quick Quantity Buttons for Packages */}
              {selectedPresentation && (
                <div>
                  <p className="text-xs text-gray-600 mb-2 font-medium">Acceso Rápido (Paquetes):</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 5, 10, 20].map(qty => (
                      <button
                        key={qty}
                        onClick={() => setPackageQuantity(qty)}
                        className="py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 text-lg"
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  onClick={handleCancel}
                  className="py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-300 flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancelar
                </button>
                <button
                  onClick={handleReplenish}
                  disabled={loading || !selectedPresentation || (packageQuantity === 0 && looseUnits === 0)}
                  className="py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 disabled:bg-gray-400 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  {loading ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>

              {/* Validation warnings */}
              {!selectedPresentation && presentations.length > 0 && (
                <div className="text-sm text-amber-700 bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <p className="font-medium">Debes seleccionar una presentación para continuar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
            <Check className="w-6 h-6 text-green-600" />
            <p className="text-green-800 font-medium flex-1">{success}</p>
          </div>
        )}

        {/* History */}
        {history.length > 0 && scanMode && (
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Historial de Reposiciones
            </h3>
            <div className="space-y-2">
              {history.map(item => (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-900">{item.product}</span>
                    <span className="text-green-600 font-bold">+{item.quantity}</span>
                  </div>
                  <div className="text-gray-600 text-xs">
                    {item.warehouse} • {item.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockReplenishmentPage;
