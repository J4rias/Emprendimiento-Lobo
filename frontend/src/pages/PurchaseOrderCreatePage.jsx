import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import { supplierService } from '../services/api/supplierService';
import { productService } from '../services/api/productService';
import { formatMoney } from '../utils/formatUtils';
import api from '../services/api/axios';
import { ArrowLeft, Plus, Trash2, Save, Send, Search, X } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardFooter,
  Input,
  Modal,
  Select,
  Textarea,
} from '../components/ui';

const PurchaseOrderCreatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [validationError, setValidationError] = useState(null);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    supplier_id: '',
    warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    currency: 'USD',
    notes: '',
    items: [],
  });

  // --- Queries ---
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'active'],
    queryFn: () => supplierService.getActive().then(r => r.data),
  });
  const suppliers = suppliersData || [];

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/inventory/warehouses').then(r => r.data?.data || r.data),
  });
  const warehouses = warehousesData || [];

  const { data: orderData } = useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => purchaseOrderService.getById(id).then(r => r.data),
    enabled: !!id,
    staleTime: Infinity,
  });

  // Populate form in edit mode once order data loads
  useEffect(() => {
    if (!orderData) return;
    if (orderData.status !== 'draft') {
      setValidationError('Solo se pueden editar órdenes en estado borrador');
      const t = setTimeout(() => navigate('/purchase-orders'), 2000);
      return () => clearTimeout(t);
    }
    setFormData({
      supplier_id: orderData.supplier_id,
      warehouse_id: orderData.warehouse_id,
      order_date: orderData.order_date,
      expected_delivery_date: orderData.expected_delivery_date || '',
      currency: orderData.currency,
      notes: orderData.notes || '',
      items: orderData.details.map(d => ({
        product_id: d.product_id,
        presentation_id: d.presentation_id,
        product_name: d.product.name,
        presentation_name: d.presentation.name,
        units_per_package: d.presentation.units_per_package,
        package_quantity: d.package_quantity,
        loose_units: d.loose_units,
        unit_cost: d.unit_cost,
        package_cost: d.package_cost,
        discount_percent: d.discount_percent,
        tax_percent: d.tax_percent,
      })),
    });
  }, [orderData, navigate]);

  // Product search debounce
  useEffect(() => {
    if (productSearch.length < 2) { setProducts([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await productService.getAll({ search: productSearch, is_active: true, limit: 20 });
        setProducts(res.products || res.data || res || []);
      } catch {
        // silent — user can retry typing
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: (data) => isEditing
      ? purchaseOrderService.update(id, data)
      : purchaseOrderService.create(data),
    onSuccess: () => {
      toast.success(isEditing ? 'Orden actualizada' : 'Borrador guardado');
      navigate('/purchase-orders');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar la orden'),
  });

  const saveAndApproveMutation = useMutation({
    mutationFn: async (data) => {
      const res = await purchaseOrderService.create(data);
      await purchaseOrderService.approve(res.data?.id);
    },
    onSuccess: () => {
      toast.success('Orden creada y aprobada');
      navigate('/purchase-orders');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al crear y aprobar la orden'),
  });

  const isSaving = saveMutation.isPending || saveAndApproveMutation.isPending;

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Barcode scanner: on Enter, auto-add if single/exact match
  const handleKeyDown = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    setTimeout(async () => {
      let current = products;
      if (current.length === 0 && productSearch.length >= 2) {
        try {
          const res = await productService.getAll({ search: productSearch, is_active: true, limit: 20 });
          current = res.products || res.data || res || [];
          setProducts(current);
        } catch { /* ignore */ }
      }
      if (current.length === 1) {
        addProduct(current[0]);
      } else if (current.length > 1) {
        const exact = current.find(p =>
          p.sku === productSearch ||
          (p.barcodes && p.barcodes.some(b => b.barcode === productSearch))
        );
        if (exact) addProduct(exact);
      }
    }, 100);
  };

  const closeProductSearch = () => {
    setShowProductSearch(false);
    setProductSearch('');
    setProducts([]);
  };

  const addProduct = (product) => {
    if (!product.presentations?.length) {
      toast.error('El producto no tiene presentaciones configuradas');
      return;
    }
    const pres = product.presentations[0];
    const already = formData.items.find(
      item => String(item.product_id) === String(product.id) &&
               String(item.presentation_id) === String(pres.id)
    );
    if (already) {
      toast.error(`"${product.name}" ya está en la orden`);
      return;
    }
    setFormData(prev => {
      const dup = prev.items.find(
        item => String(item.product_id) === String(product.id) &&
                String(item.presentation_id) === String(pres.id)
      );
      if (dup) return prev;
      return {
        ...prev,
        items: [...prev.items, {
          product_id: product.id,
          presentation_id: pres.id,
          product_name: product.name,
          presentation_name: pres.name,
          units_per_package: pres.units_per_package || 1,
          package_quantity: 0,
          loose_units: 0,
          unit_cost: pres.cost || 0,
          package_cost: pres.package_cost || 0,
          suggested_unit_cost: pres.cost || 0,
          suggested_package_cost: pres.package_cost || 0,
          discount_percent: 0,
          tax_percent: 0,
        }],
      };
    });
    closeProductSearch();
  };

  const removeItem = (index) => {
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: parseFloat(value) || 0 };
        if (field === 'unit_cost') updated.package_cost = updated.unit_cost * updated.units_per_package;
        if (field === 'package_cost') updated.unit_cost = updated.package_cost / updated.units_per_package;
        return updated;
      }),
    }));
  };

  const calculateItemTotal = (item) => {
    const subtotal = item.package_quantity * item.package_cost + item.loose_units * item.unit_cost;
    const discount = subtotal * (item.discount_percent / 100);
    const taxable = subtotal - discount;
    return taxable + taxable * (item.tax_percent / 100);
  };

  const calculateTotals = () => {
    let subtotal = 0, discount = 0, tax = 0;
    formData.items.forEach(item => {
      const itemSub = item.package_quantity * item.package_cost + item.loose_units * item.unit_cost;
      const itemDis = itemSub * (item.discount_percent / 100);
      const itemTax = (itemSub - itemDis) * (item.tax_percent / 100);
      subtotal += itemSub;
      discount += itemDis;
      tax += itemTax;
    });
    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal - discount + tax).toFixed(2),
    };
  };

  const handleSubmit = (approve = false) => {
    if (!formData.supplier_id || !formData.warehouse_id) {
      setValidationError('Proveedor y almacén son requeridos');
      return;
    }
    if (formData.items.length === 0) {
      setValidationError('Debe agregar al menos un producto');
      return;
    }
    setValidationError(null);
    const payload = {
      ...formData,
      items: formData.items.map(item => ({
        product_id: item.product_id,
        presentation_id: item.presentation_id,
        package_quantity: item.package_quantity,
        loose_units: item.loose_units,
        unit_cost: item.unit_cost,
        package_cost: item.package_cost,
        discount_percent: item.discount_percent,
        tax_percent: item.tax_percent,
      })),
    };
    if (approve) saveAndApproveMutation.mutate(payload);
    else saveMutation.mutate(payload);
  };

  const totals = calculateTotals();

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/purchase-orders')}
          className="mb-4 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Órdenes de Compra
        </Button>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
        </h1>
      </div>

      {validationError && (
        <Alert key={validationError} variant="error" dismissible className="mb-4">
          {validationError}
        </Alert>
      )}

      <Card>
        <div className="space-y-6">
          {/* Información General */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                <Select name="supplier_id" value={formData.supplier_id} onChange={handleChange}>
                  <option value="">Seleccione un proveedor</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Almacén Destino *</label>
                <Select name="warehouse_id" value={formData.warehouse_id} onChange={handleChange}>
                  <option value="">Seleccione un almacén</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Orden *</label>
                <Input type="date" name="order_date" value={formData.order_date} onChange={handleChange} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Esperada de Entrega</label>
                <Input
                  type="date"
                  name="expected_delivery_date"
                  value={formData.expected_delivery_date}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moneda *</label>
                <Select name="currency" value={formData.currency} onChange={handleChange}>
                  <option value="USD">Dólar (USD)</option>
                  <option value="COP">Peso Colombiano (COP)</option>
                  <option value="VES">Bolívar (VES)</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Productos */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
              <Button size="sm" onClick={() => setShowProductSearch(true)}>
                <Plus className="w-4 h-4" />
                Agregar Producto
              </Button>
            </div>

            {formData.items.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-gray-200 rounded-lg text-center">
                <p className="text-gray-500 text-sm">No hay productos agregados</p>
                <p className="text-gray-400 text-xs mt-1">Haz clic en "Agregar Producto" para comenzar</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paquetes</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unidades</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Paq.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Desc %</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                          <div className="text-xs text-gray-500">{item.presentation_name}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number" min="0"
                            value={item.package_quantity}
                            onChange={(e) => updateItem(index, 'package_quantity', e.target.value)}
                            className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number" min="0"
                            value={item.loose_units}
                            onChange={(e) => updateItem(index, 'loose_units', e.target.value)}
                            className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number" min="0" step="0.01"
                            value={item.package_cost}
                            onChange={(e) => updateItem(index, 'package_cost', e.target.value)}
                            className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          {item.suggested_package_cost > 0 && (
                            <div className="text-xs text-gray-400 mt-0.5" title="Último costo registrado">
                              Ant: {formatMoney(item.suggested_package_cost, formData.currency)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number" min="0" max="100" step="0.01"
                            value={item.discount_percent}
                            onChange={(e) => updateItem(index, 'discount_percent', e.target.value)}
                            className="w-16 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {formatMoney(calculateItemTotal(item), formData.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeItem(index)}
                            className="p-1 text-red-500 hover:text-red-700"
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

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <Textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Notas adicionales sobre la orden..."
            />
          </div>

          {/* Totales */}
          <Card variant="flat">
            <div className="max-w-md ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatMoney(totals.subtotal, formData.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento:</span>
                <span className="font-medium text-red-600">-{formatMoney(totals.discount, formData.currency)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span className="text-blue-600">{formatMoney(totals.total, formData.currency)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Acciones */}
        <CardFooter>
          <Button
            variant="secondary"
            onClick={() => navigate('/purchase-orders')}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={isSaving}
            loading={saveMutation.isPending}
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Borrador'}
          </Button>
          {!isEditing && (
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isSaving}
              loading={saveAndApproveMutation.isPending}
            >
              <Send className="w-4 h-4" />
              {saveAndApproveMutation.isPending ? 'Guardando...' : 'Guardar y Aprobar'}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Product Search Modal */}
      <Modal
        open={showProductSearch}
        onClose={closeProductSearch}
        title="Buscar Producto"
        size="lg"
      >
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Nombre, SKU o código de barras..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            autoFocus
          />
          {productSearch && (
            <button
              onClick={() => { setProductSearch(''); setProducts([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2">
          {products.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-500">
              {productSearch.length >= 2
                ? `Sin resultados para "${productSearch}"`
                : 'Busca por nombre, SKU o código de barras'}
            </p>
          ) : (
            products.map(product => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                {product.presentations?.length > 0 && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    {product.presentations[0].name} · Costo: {formatMoney(product.presentations[0].cost, formData.currency)}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PurchaseOrderCreatePage;
