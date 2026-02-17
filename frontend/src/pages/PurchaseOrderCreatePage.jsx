import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import { supplierService } from '../services/api/supplierService';
import { productService } from '../services/api/productService';
import api from '../services/api/axios';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  AlertCircle,
  X,
  Search
} from 'lucide-react';

const PurchaseOrderCreatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: '',
    warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    currency: 'USD',
    notes: '',
    items: []
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (id) {
      loadPurchaseOrder();
    }
  }, [id]);

  useEffect(() => {
    if (productSearch.length >= 2) {
      searchProducts();
    }
  }, [productSearch]);

  const loadInitialData = async () => {
    try {
      const [suppliersRes, warehousesRes] = await Promise.all([
        supplierService.getActive(),
        api.get('/inventory/warehouses')
      ]);

      setSuppliers(suppliersRes.data || []);
      setWarehouses(warehousesRes.data?.data || warehousesRes.data || []);
    } catch (err) {
      setError('Error al cargar los datos iniciales');
      console.error('Error loading initial data:', err);
    }
  };

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true);
      const response = await purchaseOrderService.getById(id);
      const order = response.data;

      if (order.status !== 'draft') {
        setError('Solo se pueden editar órdenes en estado borrador');
        setTimeout(() => navigate('/purchase-orders'), 2000);
        return;
      }

      setFormData({
        supplier_id: order.supplier_id,
        warehouse_id: order.warehouse_id,
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date || '',
        currency: order.currency,
        notes: order.notes || '',
        items: order.details.map(detail => ({
          product_id: detail.product_id,
          presentation_id: detail.presentation_id,
          product_name: detail.product.name,
          presentation_name: detail.presentation.name,
          units_per_package: detail.presentation.units_per_package,
          package_quantity: detail.package_quantity,
          loose_units: detail.loose_units,
          unit_cost: detail.unit_cost,
          package_cost: detail.package_cost,
          discount_percent: detail.discount_percent,
          tax_percent: detail.tax_percent
        }))
      });
    } catch (err) {
      setError('Error al cargar la orden de compra');
      console.error('Error loading purchase order:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async () => {
    try {
      const response = await productService.getProducts({
        search: productSearch,
        is_active: true,
        limit: 20
      });
      setProducts(response.products || []);
    } catch (err) {
      console.error('Error searching products:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addProduct = (product) => {
    if (!product.presentations || product.presentations.length === 0) {
      alert('El producto no tiene presentaciones configuradas');
      return;
    }

    const presentation = product.presentations[0];

    // Check if product already exists
    const exists = formData.items.find(
      item => item.product_id === product.id && item.presentation_id === presentation.id
    );

    if (exists) {
      alert('Este producto ya está en la orden');
      return;
    }

    const newItem = {
      product_id: product.id,
      presentation_id: presentation.id,
      product_name: product.name,
      presentation_name: presentation.name,
      units_per_package: presentation.units_per_package || 1,
      package_quantity: 0,
      loose_units: 0,
      unit_cost: presentation.cost || 0,
      package_cost: presentation.package_cost || 0,
      discount_percent: 0,
      tax_percent: 0
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    setShowProductSearch(false);
    setProductSearch('');
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;

        const updated = { ...item, [field]: parseFloat(value) || 0 };

        // Auto-calculate package_cost from unit_cost
        if (field === 'unit_cost') {
          updated.package_cost = updated.unit_cost * updated.units_per_package;
        }

        // Auto-calculate unit_cost from package_cost
        if (field === 'package_cost') {
          updated.unit_cost = updated.package_cost / updated.units_per_package;
        }

        return updated;
      })
    }));
  };

  const calculateItemTotal = (item) => {
    const packageTotal = item.package_quantity * item.package_cost;
    const unitsTotal = item.loose_units * item.unit_cost;
    const subtotal = packageTotal + unitsTotal;
    const discount = subtotal * (item.discount_percent / 100);
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * (item.tax_percent / 100);
    return subtotal - discount + tax;
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    formData.items.forEach(item => {
      const packageTotal = item.package_quantity * item.package_cost;
      const unitsTotal = item.loose_units * item.unit_cost;
      const itemSubtotal = packageTotal + unitsTotal;
      const itemDiscount = itemSubtotal * (item.discount_percent / 100);
      const taxableAmount = itemSubtotal - itemDiscount;
      const itemTax = taxableAmount * (item.tax_percent / 100);

      subtotal += itemSubtotal;
      discount += itemDiscount;
      tax += itemTax;
    });

    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal - discount + tax).toFixed(2)
    };
  };

  const handleSubmit = async (approve = false) => {
    if (!formData.supplier_id || !formData.warehouse_id) {
      setError('Proveedor y almacén son requeridos');
      return;
    }

    if (formData.items.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = {
        ...formData,
        items: formData.items.map(item => ({
          product_id: item.product_id,
          presentation_id: item.presentation_id,
          package_quantity: item.package_quantity,
          loose_units: item.loose_units,
          unit_cost: item.unit_cost,
          package_cost: item.package_cost,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent
        }))
      };

      let response;
      if (isEditing) {
        response = await purchaseOrderService.update(id, data);
      } else {
        response = await purchaseOrderService.create(data);
      }

      // If user wants to approve immediately
      if (approve && response.data) {
        await purchaseOrderService.approve(response.data.id);
      }

      navigate('/purchase-orders');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar la orden de compra');
      console.error('Error saving purchase order:', err);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/purchase-orders')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Órdenes de Compra
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
        </h1>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor *
                </label>
                <select
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccione un proveedor</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Almacén Destino *
                </label>
                <select
                  name="warehouse_id"
                  value={formData.warehouse_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccione un almacén</option>
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Orden *
                </label>
                <input
                  type="date"
                  name="order_date"
                  value={formData.order_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Esperada de Entrega
                </label>
                <input
                  type="date"
                  name="expected_delivery_date"
                  value={formData.expected_delivery_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda *
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="USD">Dólar (USD)</option>
                  <option value="COP">Peso Colombiano (COP)</option>
                  <option value="VES">Bolívar (VES)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
              <button
                onClick={() => setShowProductSearch(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Agregar Producto
              </button>
            </div>

            {/* Product Search Modal */}
            {showProductSearch && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Buscar Producto</h3>
                    <button
                      onClick={() => {
                        setShowProductSearch(false);
                        setProductSearch('');
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {products.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                          Busca productos por nombre o SKU
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {products.map(product => (
                            <button
                              key={product.id}
                              onClick={() => addProduct(product)}
                              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                              {product.presentations && product.presentations.length > 0 && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {product.presentations[0].name} - Costo: ${product.presentations[0].cost}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Products Table */}
            {formData.items.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">No hay productos agregados</p>
                <p className="text-sm text-gray-400 mt-1">Haz clic en "Agregar Producto" para comenzar</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Paquetes</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Unidades</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Costo Paq.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Costo Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Desc %</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">IVA %</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                          <div className="text-xs text-gray-500">{item.presentation_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            value={item.package_quantity}
                            onChange={(e) => updateItem(index, 'package_quantity', e.target.value)}
                            className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            value={item.loose_units}
                            onChange={(e) => updateItem(index, 'loose_units', e.target.value)}
                            className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.package_cost}
                            onChange={(e) => updateItem(index, 'package_cost', e.target.value)}
                            className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(index, 'unit_cost', e.target.value)}
                            className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.discount_percent}
                            onChange={(e) => updateItem(index, 'discount_percent', e.target.value)}
                            className="w-16 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.tax_percent}
                            onChange={(e) => updateItem(index, 'tax_percent', e.target.value)}
                            className="w-16 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                          ${calculateItemTotal(item).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Notas adicionales sobre la orden..."
            />
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="max-w-md ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formData.currency} {totals.subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento:</span>
                <span className="font-medium text-red-600">-{formData.currency} {totals.discount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Impuestos:</span>
                <span className="font-medium">{formData.currency} {totals.tax}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span className="text-blue-600">{formData.currency} {totals.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={() => navigate('/purchase-orders')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={() => handleSubmit(false)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            disabled={loading}
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar Borrador'}
          </button>
          {!isEditing && (
            <button
              onClick={() => handleSubmit(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              disabled={loading}
            >
              <Send className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar y Aprobar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderCreatePage;
