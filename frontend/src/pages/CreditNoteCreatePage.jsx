import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { creditNoteService } from '../services/api/creditNoteService';
import { saleService } from '../services/api/saleService';
import {
  ArrowLeft,
  Search,
  AlertCircle,
  X,
  CheckCircle,
  Package
} from 'lucide-react';

const CreditNoteCreatePage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saleNumber, setSaleNumber] = useState('');
  const [sale, setSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);

  const [formData, setFormData] = useState({
    reason: 'return',
    reason_description: '',
    type: 'partial',
    refund_method: 'none',
    refund_amount: '',
    refund_reference: '',
    notes: ''
  });

  const searchSale = async () => {
    if (!saleNumber.trim()) {
      setError('Ingrese un número de venta');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await saleService.getBySaleNumber(saleNumber);

      if (!response.data) {
        setError('Venta no encontrada');
        setSale(null);
        setReturnItems([]);
        return;
      }

      const saleData = response.data;

      // Validate sale status
      if (saleData.status === 'cancelled') {
        setError('No se puede crear nota de crédito para una venta cancelada');
        setSale(null);
        setReturnItems([]);
        return;
      }

      if (saleData.status === 'returned') {
        setError('Esta venta ya tiene una devolución completa');
        setSale(null);
        setReturnItems([]);
        return;
      }

      setSale(saleData);

      // Initialize return items
      const items = saleData.details.map(detail => ({
        sale_detail_id: detail.id,
        product_name: detail.product.name,
        presentation_name: detail.presentation.name,
        units_per_package: detail.presentation.units_per_package,
        sold_packages: detail.package_quantity,
        sold_units: detail.loose_units,
        total_units_sold: (detail.package_quantity * detail.presentation.units_per_package) + detail.loose_units,
        return_packages: 0,
        return_units: 0,
        return_to_stock: true,
        unit_price: detail.unit_price,
        discount_percent: detail.discount_percent,
        tax_percent: detail.tax_percent,
        selected: false
      }));

      setReturnItems(items);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al buscar la venta');
      console.error('Error fetching sale:', err);
      setSale(null);
      setReturnItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchSale();
    }
  };

  const updateReturnItem = (index, field, value) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== index) return item;

      const updated = { ...item, [field]: value };

      // Auto-check if any quantity is entered
      if ((field === 'return_packages' || field === 'return_units') && value > 0) {
        updated.selected = true;
      }

      // Validate that return quantity doesn't exceed sold
      if (field === 'return_packages') {
        const qty = parseInt(value) || 0;
        if (qty > item.sold_packages) {
          updated.return_packages = item.sold_packages;
        }
      }

      if (field === 'return_units') {
        const qty = parseInt(value) || 0;
        if (qty > item.sold_units) {
          updated.return_units = item.sold_units;
        }
      }

      return updated;
    }));
  };

  const toggleItemSelection = (index) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const selected = !item.selected;

      // If selecting, set return quantities to match sold quantities
      if (selected && item.return_packages === 0 && item.return_units === 0) {
        return {
          ...item,
          selected,
          return_packages: item.sold_packages,
          return_units: item.sold_units
        };
      }

      return { ...item, selected };
    }));
  };

  const calculateTotal = () => {
    let subtotal = 0;
    let tax_amount = 0;

    returnItems.forEach(item => {
      if (item.selected && (item.return_packages > 0 || item.return_units > 0)) {
        const total_units_returned = (item.return_packages * item.units_per_package) + item.return_units;
        const line_subtotal = item.unit_price * total_units_returned;
        const line_discount = line_subtotal * (item.discount_percent / 100);
        const line_tax = (line_subtotal - line_discount) * (item.tax_percent / 100);

        subtotal += line_subtotal - line_discount;
        tax_amount += line_tax;
      }
    });

    return {
      subtotal,
      tax_amount,
      total: subtotal + tax_amount
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate that at least one item is selected
    const selectedItems = returnItems.filter(item =>
      item.selected && (item.return_packages > 0 || item.return_units > 0)
    );

    if (selectedItems.length === 0) {
      setError('Debe seleccionar al menos un producto para devolver');
      return;
    }

    // Validate refund amount if refund method is not none
    if (formData.refund_method !== 'none') {
      const refundAmount = parseFloat(formData.refund_amount) || 0;
      const total = calculateTotal().total;
      if (refundAmount > total) {
        setError('El monto de reembolso no puede ser mayor al total de la nota de crédito');
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      const data = {
        sale_id: sale.id,
        reason: formData.reason,
        reason_description: formData.reason_description || null,
        type: formData.type,
        refund_method: formData.refund_method,
        refund_amount: formData.refund_method !== 'none' ? parseFloat(formData.refund_amount) || 0 : 0,
        refund_reference: formData.refund_reference || null,
        notes: formData.notes || null,
        items: selectedItems.map(item => ({
          sale_detail_id: item.sale_detail_id,
          package_quantity_returned: item.return_packages,
          loose_units_returned: item.return_units,
          return_to_stock: item.return_to_stock
        }))
      };

      await creditNoteService.create(data);
      alert('Nota de crédito creada exitosamente');
      navigate('/credit-notes');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la nota de crédito');
      console.error('Error creating credit note:', err);
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotal();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/credit-notes')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Notas de Crédito
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Crear Nota de Crédito</h1>
        <p className="text-gray-600 mt-1">Registrar devolución de productos</p>
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

      {/* Sale Search */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Buscar Venta</h2>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Número de venta (ej: VEN-20240101-0001)"
              value={saleNumber}
              onChange={(e) => setSaleNumber(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={searchSale}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Sale Info */}
      {sale && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-blue-700">Número de Venta</div>
                <div className="font-medium text-blue-900">{sale.sale_number}</div>
              </div>
              <div>
                <div className="text-sm text-blue-700">Fecha</div>
                <div className="font-medium text-blue-900">
                  {new Date(sale.sale_date).toLocaleDateString('es-PE')}
                </div>
              </div>
              <div>
                <div className="text-sm text-blue-700">Cliente</div>
                <div className="font-medium text-blue-900">{sale.customer?.name || 'Cliente General'}</div>
              </div>
              <div>
                <div className="text-sm text-blue-700">Total Venta</div>
                <div className="font-medium text-blue-900">
                  S/ {parseFloat(sale.total).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Return Form */}
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de la Devolución</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo *
                  </label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="return">Devolución</option>
                    <option value="discount">Descuento</option>
                    <option value="error">Error en la venta</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Devolución *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="partial">Parcial</option>
                    <option value="full">Total</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción del Motivo
                  </label>
                  <textarea
                    value={formData.reason_description}
                    onChange={(e) => setFormData({ ...formData, reason_description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Reembolso
                  </label>
                  <select
                    value={formData.refund_method}
                    onChange={(e) => setFormData({ ...formData, refund_method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">Sin Reembolso</option>
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="credit_balance">Saldo a Favor del Cliente</option>
                  </select>
                </div>

                {formData.refund_method !== 'none' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto a Reembolsar
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={totals.total}
                        value={formData.refund_amount}
                        onChange={(e) => setFormData({ ...formData, refund_amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Referencia de Reembolso
                      </label>
                      <input
                        type="text"
                        value={formData.refund_reference}
                        onChange={(e) => setFormData({ ...formData, refund_reference: e.target.value })}
                        placeholder="Número de cheque, transferencia, etc."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas Adicionales
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Productos a Devolver</h2>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Seleccionar</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Producto</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Vendido</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 bg-blue-50">
                          A Devolver
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Retornar al Stock</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {returnItems.map((item, index) => (
                        <tr key={index} className={item.selected ? 'bg-blue-50' : ''}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(index)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.presentation_name}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="text-sm text-gray-900">
                              {item.sold_packages}p + {item.sold_units}u
                            </div>
                            <div className="text-xs text-gray-500">
                              ({item.total_units_sold} unidades)
                            </div>
                          </td>
                          <td className="px-4 py-3 bg-blue-50">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.sold_packages}
                                  value={item.return_packages}
                                  onChange={(e) => updateReturnItem(index, 'return_packages', e.target.value)}
                                  disabled={!item.selected}
                                  className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded disabled:bg-gray-100"
                                />
                                <span className="text-xs text-gray-600">p</span>
                              </div>
                              <span className="text-gray-400">+</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.sold_units}
                                  value={item.return_units}
                                  onChange={(e) => updateReturnItem(index, 'return_units', e.target.value)}
                                  disabled={!item.selected}
                                  className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded disabled:bg-gray-100"
                                />
                                <span className="text-xs text-gray-600">u</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.return_to_stock}
                              onChange={(e) => updateReturnItem(index, 'return_to_stock', e.target.checked)}
                              disabled={!item.selected}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Productos seleccionados: <span className="font-semibold text-gray-900">
                      {returnItems.filter(i => i.selected && (i.return_packages > 0 || i.return_units > 0)).length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-right">
                      <span className="text-gray-600">Subtotal: </span>
                      <span className="font-medium">S/ {totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-right">
                      <span className="text-gray-600">Impuestos: </span>
                      <span className="font-medium">S/ {totals.tax_amount.toFixed(2)}</span>
                    </div>
                    <div className="text-lg font-bold text-right">
                      <span className="text-gray-900">Total: </span>
                      <span className="text-blue-600">S/ {totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => navigate('/credit-notes')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={saving || returnItems.filter(i => i.selected && (i.return_packages > 0 || i.return_units > 0)).length === 0}
                  >
                    <CheckCircle className="w-5 h-5" />
                    {saving ? 'Creando...' : 'Crear Nota de Crédito'}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Help Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Instrucciones:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Seleccione los productos a devolver marcando el checkbox</li>
                  <li>Ingrese las cantidades exactas a devolver (no puede exceder lo vendido)</li>
                  <li>Marque "Retornar al Stock" si desea que el producto vuelva al inventario</li>
                  <li>La nota de crédito quedará en estado "Borrador" hasta ser aprobada</li>
                  <li>Al aprobar la nota de crédito, se actualizará automáticamente el inventario</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CreditNoteCreatePage;
