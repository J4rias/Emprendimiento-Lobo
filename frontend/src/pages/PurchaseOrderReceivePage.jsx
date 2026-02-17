import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import {
  ArrowLeft,
  Package,
  AlertCircle,
  X,
  CheckCircle,
  Calendar
} from 'lucide-react';

const PurchaseOrderReceivePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [receivedItems, setReceivedItems] = useState([]);

  useEffect(() => {
    loadPurchaseOrder();
  }, [id]);

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true);
      const response = await purchaseOrderService.getById(id);
      const orderData = response.data;

      if (!['sent', 'confirmed', 'partially_received'].includes(orderData.status)) {
        setError('Esta orden no está en un estado que permita recibir mercancía');
        setTimeout(() => navigate('/purchase-orders'), 2000);
        return;
      }

      setOrder(orderData);

      // Initialize received items
      const items = orderData.details.map(detail => ({
        detail_id: detail.id,
        product_name: detail.product.name,
        presentation_name: detail.presentation.name,
        units_per_package: detail.presentation.units_per_package,
        ordered_packages: detail.package_quantity,
        ordered_units: detail.loose_units,
        received_packages: detail.received_package_quantity,
        received_units: detail.received_loose_units,
        pending_packages: detail.package_quantity - detail.received_package_quantity,
        pending_units: detail.loose_units - detail.received_loose_units,
        receiving_packages: 0,
        receiving_units: 0,
        batch_number: '',
        manufacture_date: '',
        expiry_date: ''
      }));

      setReceivedItems(items);
    } catch (err) {
      setError('Error al cargar la orden de compra');
      console.error('Error loading purchase order:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateReceivingItem = (index, field, value) => {
    setReceivedItems(prev => prev.map((item, i) => {
      if (i !== index) return item;

      const updated = { ...item, [field]: value };

      // Validate that receiving quantity doesn't exceed pending
      if (field === 'receiving_packages') {
        const qty = parseInt(value) || 0;
        if (qty > item.pending_packages) {
          updated.receiving_packages = item.pending_packages;
        }
      }

      if (field === 'receiving_units') {
        const qty = parseInt(value) || 0;
        if (qty > item.pending_units) {
          updated.receiving_units = item.pending_units;
        }
      }

      return updated;
    }));
  };

  const handleReceive = async () => {
    // Validate that at least one item is being received
    const hasItems = receivedItems.some(
      item => item.receiving_packages > 0 || item.receiving_units > 0
    );

    if (!hasItems) {
      setError('Debe especificar al menos un producto a recibir');
      return;
    }

    // Validate quantities
    for (const item of receivedItems) {
      if (item.receiving_packages > item.pending_packages) {
        setError(`No puede recibir más paquetes de los pendientes para ${item.product_name}`);
        return;
      }
      if (item.receiving_units > item.pending_units) {
        setError(`No puede recibir más unidades de las pendientes para ${item.product_name}`);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      const data = {
        received_items: receivedItems
          .filter(item => item.receiving_packages > 0 || item.receiving_units > 0)
          .map(item => ({
            detail_id: item.detail_id,
            package_quantity: item.receiving_packages,
            loose_units: item.receiving_units,
            batch_number: item.batch_number || null,
            manufacture_date: item.manufacture_date || null,
            expiry_date: item.expiry_date || null
          })),
        invoice_number: invoiceNumber,
        notes: notes
      };

      await purchaseOrderService.receive(id, data);

      alert('Mercancía recibida exitosamente');
      navigate('/purchase-orders');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al recibir la mercancía');
      console.error('Error receiving merchandise:', err);
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalReceiving = () => {
    return receivedItems.reduce((total, item) => {
      const packages = item.receiving_packages * item.units_per_package;
      const units = item.receiving_units;
      return total + packages + units;
    }, 0);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando orden de compra...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Recibir Mercancía</h1>
            <p className="text-gray-600 mt-1">Orden: {order.order_number}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Proveedor</div>
            <div className="font-medium text-gray-900">{order.supplier.name}</div>
          </div>
        </div>
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

      {/* Order Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-blue-700">Fecha de Orden</div>
            <div className="font-medium text-blue-900">
              {new Date(order.order_date).toLocaleDateString('es-PE')}
            </div>
          </div>
          <div>
            <div className="text-sm text-blue-700">Almacén Destino</div>
            <div className="font-medium text-blue-900">{order.warehouse.name}</div>
          </div>
          <div>
            <div className="text-sm text-blue-700">Total Orden</div>
            <div className="font-medium text-blue-900">
              {order.currency} {parseFloat(order.total).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-blue-700">Estado</div>
            <div className="font-medium text-blue-900">
              {order.status === 'sent' && 'Enviada'}
              {order.status === 'confirmed' && 'Confirmada'}
              {order.status === 'partially_received' && 'Parcialmente Recibida'}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de Recepción</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Factura/Remisión
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: F-2024-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas de Recepción
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Receiving Table */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Productos a Recibir</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Producto</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Ordenado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Ya Recibido</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Pendiente</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 bg-blue-50">
                    Recibir Ahora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Lote (Opcional)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {receivedItems.map((item, index) => (
                  <tr key={index} className={item.pending_packages === 0 && item.pending_units === 0 ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                      <div className="text-xs text-gray-500">{item.presentation_name}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm text-gray-900">
                        {item.ordered_packages}p + {item.ordered_units}u
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm text-gray-600">
                        {item.received_packages}p + {item.received_units}u
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm font-medium text-orange-600">
                        {item.pending_packages}p + {item.pending_units}u
                      </div>
                    </td>
                    <td className="px-4 py-3 bg-blue-50">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max={item.pending_packages}
                            value={item.receiving_packages}
                            onChange={(e) => updateReceivingItem(index, 'receiving_packages', e.target.value)}
                            className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded"
                            disabled={item.pending_packages === 0}
                          />
                          <span className="text-xs text-gray-600">p</span>
                        </div>
                        <span className="text-gray-400">+</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max={item.pending_units}
                            value={item.receiving_units}
                            onChange={(e) => updateReceivingItem(index, 'receiving_units', e.target.value)}
                            className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded"
                            disabled={item.pending_units === 0}
                          />
                          <span className="text-xs text-gray-600">u</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Número de lote"
                          value={item.batch_number}
                          onChange={(e) => updateReceivingItem(index, 'batch_number', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                        <div className="flex gap-1">
                          <input
                            type="date"
                            placeholder="Fabricación"
                            value={item.manufacture_date}
                            onChange={(e) => updateReceivingItem(index, 'manufacture_date', e.target.value)}
                            className="w-1/2 px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                          <input
                            type="date"
                            placeholder="Expiración"
                            value={item.expiry_date}
                            onChange={(e) => updateReceivingItem(index, 'expiry_date', e.target.value)}
                            className="w-1/2 px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        </div>
                      </div>
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
              Total de unidades a recibir: <span className="font-semibold text-gray-900">{calculateTotalReceiving()}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/purchase-orders')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleReceive}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={saving || calculateTotalReceiving() === 0}
              >
                <CheckCircle className="w-5 h-5" />
                {saving ? 'Procesando...' : 'Confirmar Recepción'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Help Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Instrucciones:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ingrese las cantidades que está recibiendo ahora (puede ser parcial)</li>
              <li>No puede recibir más de lo que está pendiente</li>
              <li>Opcionalmente puede registrar información del lote</li>
              <li>Los costos de los productos se actualizarán automáticamente según la orden</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderReceivePage;
