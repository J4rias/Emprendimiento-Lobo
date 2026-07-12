import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash, Package, MagnifyingGlass, Check } from '@phosphor-icons/react';
import { warehouseService } from '../../services/api/warehouseService';
import { inventoryService } from '../../services/api/inventoryService';
import { toast } from 'sonner';

const TransferFormModal = ({ isOpen, onClose, onSubmit, preselectedItems = [], sourceWarehouseId = null }) => {
  const [formData, setFormData] = useState({
    origin_warehouse_id: '',
    destination_warehouse_id: '',
    notes: '',
    items: []
  });

  const [warehouses, setWarehouses] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerms, setSearchTerms] = useState({}); // Un término de búsqueda por cada item
  const initializedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      console.log('Modal opened, fetching data...');
      fetchWarehouses();

      // Inicializar con datos preseleccionados si existen
      if (sourceWarehouseId) {
        setFormData(prev => ({
          ...prev,
          origin_warehouse_id: sourceWarehouseId.toString()
        }));
      }

      if (preselectedItems && preselectedItems.length > 0) {
        const initialItems = preselectedItems.map((item, index) => ({
          _tempId: Date.now() + index,
          product_id: item.product_id,
          presentation_id: item.presentation_id,
          package_quantity: item.package_quantity || 0,
          loose_units: item.loose_units || 0,
          batch_id: null
        }));

        setFormData(prev => ({
          ...prev,
          items: initialItems
        }));
      }

      initializedRef.current = true;
    } else if (!isOpen) {
      // Reset form when modal is closed
      setFormData({
        origin_warehouse_id: '',
        destination_warehouse_id: '',
        notes: '',
        items: []
      });
      setSearchTerms({});
      setAvailableProducts([]);
      initializedRef.current = false;
    }
  }, [isOpen]);

  // Fetch available products when origin warehouse changes
  useEffect(() => {
    if (formData.origin_warehouse_id) {
      fetchAvailableProducts(formData.origin_warehouse_id);
    } else {
      setAvailableProducts([]);
    }
  }, [formData.origin_warehouse_id]);

  const fetchWarehouses = async () => {
    try {
      const response = await warehouseService.getAll();
      setWarehouses(response.data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      toast.error('Error al cargar almacenes');
    }
  };

  const fetchAvailableProducts = async (warehouseId) => {
    try {
      const response = await inventoryService.getByWarehouse(warehouseId, { limit: 1000 });
      console.log('Inventory response:', response);

      // Extract inventory items with stock
      const inventoryData = response.data || [];

      // Filter products with available stock and map to include quantity info
      const productsWithStock = inventoryData
        .filter(item => {
          const availableQty = parseFloat(item.available_quantity || item.quantity || 0);
          return availableQty > 0;
        })
        .map(item => ({
          id: item.product?.id || item.product_id,
          name: item.product?.name || 'Producto sin nombre',
          sku: item.product?.sku,
          available_quantity: parseFloat(item.available_quantity || item.quantity || 0),
          quantity: parseFloat(item.quantity || 0),
          reserved_quantity: parseFloat(item.reserved_quantity || 0),
          presentations: item.product?.presentations || [],
          product: item.product
        }));

      setAvailableProducts(productsWithStock);
      console.log('Loaded products with stock:', productsWithStock.length);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Error al cargar productos disponibles');
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          _tempId: Date.now(), // Add unique temporary ID for tracking
          product_id: '',
          presentation_id: null,
          package_quantity: 0,
          loose_units: 0,
          batch_id: null,
          notes: ''
        }
      ]
    });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });

    // Reorganize search terms - shift down all indices after the removed one
    const newSearchTerms = {};
    Object.keys(searchTerms).forEach(key => {
      const idx = parseInt(key);
      if (idx < index) {
        // Keep items before the removed index
        newSearchTerms[idx] = searchTerms[idx];
      } else if (idx > index) {
        // Shift down items after the removed index
        newSearchTerms[idx - 1] = searchTerms[idx];
      }
      // Skip the removed index
    });
    setSearchTerms(newSearchTerms);
  };

  const updateSearchTerm = (index, value) => {
    setSearchTerms({
      ...searchTerms,
      [index]: value
    });
  };

  const getFilteredProducts = (index) => {
    const searchTerm = searchTerms[index] || '';
    if (!searchTerm) return availableProducts;

    return availableProducts.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // If product changes, update its presentations
    if (field === 'product_id' && value) {
      const product = availableProducts.find(p => p.id === parseInt(value));
      console.log('Selected product:', product);

      if (product) {
        newItems[index].selectedProduct = product;

        // Auto-select default presentation if available
        const defaultPresentation = product.presentations?.find(p => p.is_default) || product.presentations?.[0];
        if (defaultPresentation) {
          newItems[index].presentation_id = defaultPresentation.id.toString();
        } else {
          newItems[index].presentation_id = null;
        }
      }
    }

    setFormData({ ...formData, items: newItems });
  };

  // Calculate total units for an item
  const calculateTotalUnits = (item, product) => {
    if (!product) return 0;

    const presentation = product.presentations?.find(p => p.id === parseInt(item.presentation_id));
    const unitsPerPkg = presentation?.units_per_package || 1;
    const pkgUnits = (parseInt(item.package_quantity) || 0) * unitsPerPkg;
    const looseUnits = parseInt(item.loose_units) || 0;
    return pkgUnits + looseUnits;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations
    if (!formData.origin_warehouse_id || !formData.destination_warehouse_id) {
      toast.error('Debes seleccionar almacén de origen y destino');
      return;
    }

    if (formData.origin_warehouse_id === formData.destination_warehouse_id) {
      toast.error('El almacén de origen y destino deben ser diferentes');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('Debes agregar al menos un producto');
      return;
    }

    // Validate items
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.product_id) {
        toast.error(`Debes seleccionar un producto en el ítem ${i + 1}`);
        return;
      }

      // Validate product has presentations
      const product = item.selectedProduct || availableProducts.find(p => p.id === parseInt(item.product_id));
      if (!product?.presentations || product.presentations.length === 0) {
        toast.error(`El producto en el ítem ${i + 1} no tiene presentaciones configuradas. Primero debes agregar una presentación al producto.`);
        return;
      }

      const total = parseFloat(item.package_quantity || 0) + parseFloat(item.loose_units || 0);
      if (total <= 0) {
        toast.error(`La cantidad debe ser mayor a cero en el ítem ${i + 1}`);
        return;
      }
    }

    setLoading(true);
    try {
      // Clean up items - remove temporary fields before sending to backend
      const cleanedData = {
        ...formData,
        origin_warehouse_id: parseInt(formData.origin_warehouse_id),
        destination_warehouse_id: parseInt(formData.destination_warehouse_id),
        items: formData.items.map(({ _tempId, selectedProduct, ...item }) => ({
          ...item,
          product_id: parseInt(item.product_id),
          presentation_id: item.presentation_id ? parseInt(item.presentation_id) : null,
          package_quantity: parseInt(item.package_quantity) || 0,
          loose_units: parseInt(item.loose_units) || 0,
          batch_id: item.batch_id ? parseInt(item.batch_id) : null
        }))
      };

      console.log('Sending transfer data:', cleanedData);
      await onSubmit(cleanedData);
      // Reset form
      setFormData({
        origin_warehouse_id: '',
        destination_warehouse_id: '',
        notes: '',
        items: []
      });
      setSearchTerms({});
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nueva Transferencia</h2>
            <p className="text-sm text-gray-600">Transfiere productos entre almacenes</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Warehouse Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Almacén de Origen *
              </label>
              <select
                value={formData.origin_warehouse_id}
                onChange={(e) => {
                  const newOriginId = e.target.value;
                  // Clear destination if it's the same as the new origin
                  const newDestinationId = newOriginId === formData.destination_warehouse_id ? '' : formData.destination_warehouse_id;
                  // Clear all items when origin warehouse changes
                  setFormData({
                    ...formData,
                    origin_warehouse_id: newOriginId,
                    destination_warehouse_id: newDestinationId,
                    items: []
                  });
                  // Clear search terms
                  setSearchTerms({});
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                required
              >
                <option value="">Seleccionar almacén</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Almacén de Destino *
              </label>
              <select
                value={formData.destination_warehouse_id}
                onChange={(e) => setFormData({ ...formData, destination_warehouse_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                required
              >
                <option value="">Seleccionar almacén</option>
                {warehouses
                  .filter(w => w.id.toString() !== formData.origin_warehouse_id.toString())
                  .map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas (Opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
              placeholder="Notas adicionales sobre esta transferencia..."
            />
          </div>

          {/* Items Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Productos a Transferir</h3>
              <button
                type="button"
                onClick={addItem}
                disabled={!formData.origin_warehouse_id || !formData.destination_warehouse_id}
                className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
                title={!formData.origin_warehouse_id || !formData.destination_warehouse_id ? 'Selecciona ambos almacenes primero' : ''}
              >
                <Plus size={16} />
                Agregar Producto
              </button>
            </div>

            {formData.items.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Package size={48} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">No hay productos agregados</p>
                <p className="text-sm text-gray-500">Haz clic en "Agregar Producto" para comenzar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.items.map((item, index) => {
                  const product = item.selectedProduct || availableProducts.find(p => p.id === parseInt(item.product_id));
                  return (
                    <div key={item._tempId || index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-medium text-gray-900">Producto #{index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product Selection with Autocomplete */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Producto *
                          </label>
                          <div className="relative">
                            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" size={18} />
                            <input
                              type="text"
                              placeholder="Buscar y seleccionar producto..."
                              value={
                                item.product_id
                                  ? availableProducts.find(p => p.id === parseInt(item.product_id))?.name || ''
                                  : searchTerms[index] || ''
                              }
                              onChange={(e) => {
                                updateSearchTerm(index, e.target.value);
                                // Clear selection when typing
                                if (item.product_id) {
                                  updateItem(index, 'product_id', '');
                                }
                              }}
                              onFocus={() => {
                                // Show dropdown on focus if no product selected
                                if (!item.product_id) {
                                  updateSearchTerm(index, searchTerms[index] || '');
                                }
                              }}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                              required
                            />

                            {/* Dropdown suggestions */}
                            {!item.product_id && (searchTerms[index] !== undefined) && (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {getFilteredProducts(index).length > 0 ? (
                                  getFilteredProducts(index).map(p => (
                                    <div
                                      key={p.id}
                                      onClick={() => {
                                        updateItem(index, 'product_id', p.id.toString());
                                        updateSearchTerm(index, undefined);
                                      }}
                                      className="px-4 py-2 hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-900">{p.name}</div>
                                          {p.sku && <div className="text-xs text-gray-500">SKU: {p.sku}</div>}
                                        </div>
                                        <div className="ml-4 text-right">
                                          <div className="text-xs font-medium text-primary-600">Disponible:</div>
                                          <div className="text-xs text-gray-600">{p.available_quantity} uds.</div>
                                          {p.reserved_quantity > 0 && (
                                            <div className="text-xs text-orange-600">({p.reserved_quantity} reservadas)</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-gray-500 text-sm">
                                    {formData.origin_warehouse_id
                                      ? 'No se encontraron productos con stock'
                                      : 'Primero selecciona un almacén de origen'}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Clear button */}
                            {item.product_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem(index, 'product_id', '');
                                  updateSearchTerm(index, '');
                                }}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X size={18} />
                              </button>
                            )}
                          </div>
                          {item.product_id && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <Check size={14} />
                              Producto seleccionado
                            </p>
                          )}
                        </div>

                        {/* Presentation */}
                        {product && product.presentations && product.presentations.length > 0 ? (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Presentación *
                            </label>
                            <select
                              value={item.presentation_id || ''}
                              onChange={(e) => updateItem(index, 'presentation_id', e.target.value || null)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                            >
                              <option value="">Seleccionar presentación</option>
                              {product.presentations.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} - {p.units_per_package} uds/paquete
                                  {parseFloat(p.package_price || 0) > 0 ? ` - ${parseFloat(p.package_price).toFixed(2)}` : ''}
                                  {p.is_default ? ' (Predeterminada)' : ''}
                                </option>
                              ))}
                            </select>

                            {/* Visual indicator for selected presentation */}
                            {item.presentation_id && (() => {
                              const selectedPresentation = product.presentations.find(p => p.id === parseInt(item.presentation_id));
                              return selectedPresentation && (
                                <div className="mt-2 p-2 bg-primary-50 border border-primary-200 rounded text-xs text-gray-700">
                                  <div className="flex items-center gap-2">
                                    <Package size={14} className="text-primary-600" />
                                    <span className="font-medium">Cada paquete contiene: {selectedPresentation.units_per_package} unidades</span>
                                  </div>
                                  {selectedPresentation.package_cost > 0 && (
                                    <div className="mt-1 ml-5">💰 Costo/paquete: ${parseFloat(selectedPresentation.package_cost).toFixed(2)}</div>
                                  )}
                                  {selectedPresentation.package_price > 0 && (
                                    <div className="mt-1 ml-5">💵 Precio/paquete: ${parseFloat(selectedPresentation.package_price).toFixed(2)}</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ) : product && (
                          <div className="md:col-span-2">
                            <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                              ⚠️ Este producto no tiene presentaciones configuradas. Debes agregar al menos una presentación antes de poder transferirlo.
                            </div>
                          </div>
                        )}

                        {/* Package Quantity */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cantidad de Paquetes
                            {item.presentation_id && (() => {
                              const selectedPresentation = product?.presentations?.find(p => p.id === parseInt(item.presentation_id));
                              return selectedPresentation && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ({selectedPresentation.units_per_package} uds/paquete)
                                </span>
                              );
                            })()}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.package_quantity}
                            onChange={(e) => updateItem(index, 'package_quantity', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                          />
                        </div>

                        {/* Loose Units */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Unidades Sueltas
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.loose_units}
                            onChange={(e) => updateItem(index, 'loose_units', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                          />
                        </div>

                        {/* Total Units Calculation Display */}
                        {product && item.presentation_id && (parseInt(item.package_quantity) > 0 || parseInt(item.loose_units) > 0) && (
                          <div className="md:col-span-2">
                            <div className="p-3 bg-green-50 border border-green-300 rounded-lg">
                              <div className="text-sm font-medium text-green-900">
                                📦 Total a transferir:
                              </div>
                              <div className="text-xs text-green-700 mt-1">
                                {(() => {
                                  const selectedPresentation = product.presentations?.find(p => p.id === parseInt(item.presentation_id));
                                  const unitsPerPkg = selectedPresentation?.units_per_package || 1;
                                  const pkgQty = parseInt(item.package_quantity) || 0;
                                  const looseUnits = parseInt(item.loose_units) || 0;
                                  const pkgUnits = pkgQty * unitsPerPkg;
                                  const totalUnits = pkgUnits + looseUnits;

                                  return (
                                    <>
                                      {pkgQty > 0 && (
                                        <span>({pkgQty} {pkgQty === 1 ? 'paquete' : 'paquetes'} × {unitsPerPkg} uds/paquete = {pkgUnits} uds)</span>
                                      )}
                                      {pkgQty > 0 && looseUnits > 0 && <span> + </span>}
                                      {looseUnits > 0 && (
                                        <span>({looseUnits} {looseUnits === 1 ? 'suelta' : 'sueltas'})</span>
                                      )}
                                      <span className="font-bold ml-1">= {totalUnits} unidades totales</span>

                                      {/* Warning if exceeds available quantity */}
                                      {totalUnits > product.available_quantity && (
                                        <div className="mt-1 text-orange-700">
                                          ⚠️ Excede la cantidad disponible ({product.available_quantity} uds)
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Item Notes */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notas del producto (Opcional)
                          </label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateItem(index, 'notes', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                            placeholder="Notas adicionales..."
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creando...
                </>
              ) : (
                <>
                  <Package size={16} />
                  Crear Transferencia
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferFormModal;
