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
  const [quantity, setQuantity] = useState(1);
  const [warehouseId, setWarehouseId] = useState(1);
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
      
      if (response.success && response.data) {
        setProduct(response.data);
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

  const handleQuantityChange = (delta) => {
    const newQuantity = Math.max(1, quantity + delta);
    setQuantity(newQuantity);
  };

  const handleReplenish = async () => {
    if (!product) return;

    setLoading(true);
    setError(null);

    try {
      await inventoryService.adjustInventory({
        product_id: product.id,
        warehouse_id: warehouseId,
        quantity: quantity,
        type: 'add',
        reason: `Reposición de stock - Escáner móvil por ${user?.name || 'Usuario'}`
      });

      // Add to history
      const historyItem = {
        id: Date.now(),
        product: product.name,
        sku: product.sku,
        quantity: quantity,
        warehouse: warehouses.find(w => w.id === warehouseId)?.name,
        timestamp: new Date().toLocaleTimeString()
      };
      setHistory([historyItem, ...history.slice(0, 9)]); // Keep last 10

      setSuccess(`✓ ${quantity} unidades agregadas correctamente`);
      
      // Reset for next scan
      setTimeout(() => {
        setProduct(null);
        setQuantity(1);
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
    setQuantity(1);
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
                  {product.presentations?.[0] && (
                    <p className="text-green-100 text-sm mt-1">
                      {product.presentations[0].name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Cantidad a Agregar
              </label>
              
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  className="w-16 h-16 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 flex items-center justify-center"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-8 h-8" />
                </button>
                
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center text-4xl font-bold py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
                
                <button
                  onClick={() => handleQuantityChange(1)}
                  className="w-16 h-16 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 flex items-center justify-center"
                >
                  <Plus className="w-8 h-8" />
                </button>
              </div>

              {/* Quick Quantity Buttons */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {[5, 10, 25, 50].map(qty => (
                  <button
                    key={qty}
                    onClick={() => setQuantity(qty)}
                    className="py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
                  >
                    +{qty}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCancel}
                  className="py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-300 flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancelar
                </button>
                <button
                  onClick={handleReplenish}
                  disabled={loading}
                  className="py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  {loading ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
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
