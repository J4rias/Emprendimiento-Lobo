import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryService } from '../services/api/inventoryService';
import { ArrowLeft, Package, Calendar, DollarSign, AlertTriangle, Warehouse, Edit, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const InventoryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [convertedValue, setConvertedValue] = useState(null);
  const [movements, setMovements] = useState([]);

  const currencies = [
    { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
    { code: 'COP', name: 'Peso Colombiano', symbol: '$' },
    { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs' }
  ];

  useEffect(() => {
    fetchInventoryDetail();
    fetchMovements();
  }, [id]);

  const fetchMovements = async () => {
    try {
      const response = await inventoryService.getMovements({
        product_id: inventory?.product_id, // We'll get this from inventory state later if needed
        limit: 10
      });
      setMovements(response.data);
    } catch (err) {
      console.error('Error fetching movements:', err);
    }
  };

  const fetchInventoryDetail = async () => {
    try {
      const response = await inventoryService.getById(id);
      setInventory(response.data);

      // Set selected currency to the product's original currency
      const presentation = response.data?.product?.presentations?.[0];
      if (presentation?.purchase_currency) {
        setSelectedCurrency(presentation.purchase_currency);
      }

      // Also fetch movements once we have the product_id
      const movResponse = await inventoryService.getMovements({
        product_id: response.data.product_id,
        limit: 10
      });
      setMovements(movResponse.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar detalles del inventario');
    } finally {
      setLoading(false);
    }
  };

  const presentation = inventory?.product?.presentations?.[0];
  const unitCost = parseFloat(presentation?.cost || 0);

  // Convert unit cost when currency changes
  useEffect(() => {
    const convertValue = async () => {
      if (!presentation) {
        setConvertedValue(null);
        return;
      }

      const originalCurrency = presentation.purchase_currency || 'USD';

      // If selected currency is the same as original, no conversion needed
      if (selectedCurrency === originalCurrency) {
        setConvertedValue(null);
        return;
      }

      try {
        const unitCost = parseFloat(presentation.cost);
        const response = await fetch(
          `${API_URL}/exchange-rates/convert?amount=${unitCost}&from_currency=${originalCurrency}&to_currency=${selectedCurrency}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setConvertedValue(data.data);
        } else {
          setConvertedValue({ error: true });
        }
      } catch (error) {
        console.error('Error converting currency:', error);
        setConvertedValue({ error: true });
      }
    };

    convertValue();
  }, [selectedCurrency, inventory, token]);

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
            <p className="font-medium">{inventory.product.brand?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tamaño de Unidad</p>
            <p className="font-medium">
              {inventory.product.unit_size
                ? `${parseFloat(inventory.product.unit_size)} ${inventory.product.unit_size_measure || 'UND'}`
                : inventory.product.unit_size_measure || 'UND'
              }
            </p>
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

      {/* Presentations Info */}
      {inventory.product.presentations && inventory.product.presentations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Presentaciones del Producto
          </h2>
          <div className="space-y-3">
            {inventory.product.presentations.map((presentation) => (
              <div
                key={presentation.id}
                className={`p-4 rounded-lg border-2 ${presentation.is_default
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-gray-50 border-gray-200'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{presentation.name}</h3>
                      {presentation.is_default && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
                          Predeterminada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Código de barras: {presentation.barcode || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Unidades por paquete</p>
                    <p className="font-semibold text-gray-900">{presentation.units_per_package} uds</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Costo por paquete</p>
                    <p className="font-semibold text-gray-900">
                      ${parseFloat(presentation.package_cost || 0).toFixed(2)} {presentation.purchase_currency || 'USD'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Precio por paquete</p>
                    <p className="font-semibold text-green-600">
                      ${parseFloat(presentation.package_price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Costo por unidad</p>
                    <p className="font-semibold text-gray-900">
                      ${parseFloat(presentation.cost || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {presentation.description && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600">Descripción</p>
                    <p className="text-sm text-gray-700">{presentation.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de Stock</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Stock Actual</p>
            <p className="text-2xl font-bold text-blue-600 mb-1">{Math.floor(inventory.quantity)}</p>
            {(() => {
              const defaultPres = inventory?.product?.presentations?.find(p => p.is_default) || inventory?.product?.presentations?.[0];
              const unitsPerPacking = defaultPres?.units_per_package || 1;
              const totalUnits = Math.floor(inventory.quantity);
              const totalPackages = Math.floor(totalUnits / unitsPerPacking);
              const totalUnitsInPackages = totalPackages * unitsPerPacking;
              const totalLooseUnits = totalUnits % unitsPerPacking;

              return (
                <div className="text-xs text-blue-700 font-medium">
                  {totalPackages} {totalPackages === 1 ? 'Paquete' : 'Paquetes'} ({totalUnitsInPackages} uds)
                  <br />
                  y {totalLooseUnits} {totalLooseUnits === 1 ? 'unidad suelta' : 'unidades sueltas'}
                </div>
              );
            })()}
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="flex items-center justify-center gap-2 mb-2">
              <p className="text-sm text-gray-600">Valor Unitario</p>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                title="Seleccionar moneda"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code}
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const originalCurrency = presentation?.purchase_currency || 'USD';
              const cost = presentation?.cost || '0.00';
              const originalCurrencyInfo = currencies.find(c => c.code === originalCurrency);

              if (convertedValue?.error) {
                return (
                  <div>
                    <p className="text-2xl font-bold text-gray-400">
                      N/A {selectedCurrency}
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      Tasa no disponible
                    </p>
                  </div>
                );
              }

              if (!convertedValue) {
                // Show in original currency
                return (
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {originalCurrencyInfo?.symbol}{parseFloat(cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {originalCurrency}
                    </p>
                  </div>
                );
              } else {
                // Show converted value
                const selectedCurrencyInfo = currencies.find(c => c.code === selectedCurrency);
                return (
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedCurrencyInfo?.symbol}{convertedValue.converted_amount?.toFixed(2)} {selectedCurrency}
                    </p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-500">
                        {originalCurrencyInfo?.symbol}{parseFloat(cost).toFixed(2)} {originalCurrency} × {convertedValue.rate?.toFixed(4)}
                      </p>
                    </div>
                  </div>
                );
              }
            })()}
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

      {/* Movement History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-gray-500" />
          Historial de Movimientos
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {movements.length > 0 ? (
                movements.map((movement) => (
                  <tr key={movement.id} className="bg-white hover:bg-gray-50 text-gray-900">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(movement.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${movement.movement_type.includes('positivo') || ['compra', 'devolucion_cliente'].includes(movement.movement_type)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {movement.movement_type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {movement.movement_type.includes('positivo') || ['compra', 'devolucion_cliente'].includes(movement.movement_type) ? '+' : '-'}
                      {parseFloat(movement.quantity)} uds
                    </td>
                    <td className="px-4 py-3">
                      {movement.reason || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {movement.user ? `${movement.user.first_name || ''} ${movement.user.last_name || ''}`.trim() || movement.user.username : 'Sistema'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                    No hay movimientos registrados para este producto
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryDetailPage;
