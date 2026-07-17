import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney, formatDateShort } from '../utils/formatUtils';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import {
  ArrowLeft,
  CheckCircle,
  ClipboardText,
} from '@phosphor-icons/react';
import { Alert, Button, Card, Input, Modal, Spinner, Textarea } from '../components/ui';

interface ReceivedItem {
  detail_id: number;
  product_name: string;
  presentation_name: string;
  units_per_package: number;
  ordered_packages: number;
  ordered_units: number;
  received_packages: number;
  received_units: number;
  pending_packages: number;
  pending_units: number;
  receiving_packages: number;
  receiving_units: number;
  batch_number: string;
  manufacture_date: string;
  expiry_date: string;
}

interface OrderDetail {
  id: number;
  product: { name: string };
  presentation: { name: string; units_per_package: number };
  package_quantity: number;
  loose_units: number;
  received_package_quantity: number;
  received_loose_units: number;
}

interface PurchaseOrder {
  status: string;
  last_invoice_number?: string;
  details: OrderDetail[];
  order_number: string;
  supplier: { name: string };
  warehouse: { name: string };
  order_date: string;
  total: number;
  currency: string;
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  sent: 'Enviada',
  confirmed: 'Confirmada',
  partially_received: 'Parcialmente Recibida',
};

const PurchaseOrderReceivePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [validationError, setValidationError] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isFullyReceived, setIsFullyReceived] = useState(false);
  const initialized = useRef(false);

  // --- Query ---
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['purchaseOrder', id],
    queryFn: () => purchaseOrderService.getById(Number(id)).then((r: { data: PurchaseOrder }) => r.data),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!order || initialized.current) return;
    if (!['sent', 'confirmed', 'partially_received'].includes(order.status)) {
      setValidationError('Esta orden no está en un estado que permita recibir mercancía');
      setTimeout(() => navigate('/purchase-orders'), 2000);
      return;
    }
    initialized.current = true;
    setInvoiceNumber(order.last_invoice_number || '');
    setReceivedItems(order.details.map((d: OrderDetail) => ({
      detail_id: d.id,
      product_name: d.product.name,
      presentation_name: d.presentation.name,
      units_per_package: d.presentation.units_per_package,
      ordered_packages: d.package_quantity,
      ordered_units: d.loose_units,
      received_packages: d.received_package_quantity,
      received_units: d.received_loose_units,
      pending_packages: d.package_quantity - d.received_package_quantity,
      pending_units: d.loose_units - d.received_loose_units,
      receiving_packages: 0,
      receiving_units: 0,
      batch_number: '',
      manufacture_date: '',
      expiry_date: '',
    })));
  }, [order, navigate]);

  // --- Mutation ---
  const receiveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => purchaseOrderService.receive(Number(id), data),
    onSuccess: () => {
      toast.success('Mercancía recibida correctamente');
      queryClient.invalidateQueries({ queryKey: ['supplier-resumen'] });
      navigate('/purchase-orders');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al recibir la mercancía');
    },
  });

  // --- Handlers ---
  const updateReceivingItem = (index: number, field: 'receiving_packages' | 'receiving_units', value: string) => {
    setReceivedItems(prev => prev.map((item: ReceivedItem, i: number) => {
      if (i !== index) return item;
      let val = parseInt(value) || 0;
      if (val < 0) val = 0;
      const updated = { ...item };
      if (field === 'receiving_packages') updated.receiving_packages = Math.min(val, item.pending_packages);
      if (field === 'receiving_units') updated.receiving_units = Math.min(val, item.pending_units);
      return updated;
    }));
  };

  const handleReceiveAll = () => {
    setReceivedItems(prev => prev.map((item: ReceivedItem) => ({
      ...item,
      receiving_packages: item.pending_packages,
      receiving_units: item.pending_units,
    })));
  };

  const handleReceive = () => {
    const hasItems = receivedItems.some((item: ReceivedItem) => item.receiving_packages > 0 || item.receiving_units > 0);
    if (!hasItems) {
      setValidationError('Debe especificar al menos un producto a recibir con cantidad mayor a cero');
      return;
    }
    if (!invoiceNumber.trim()) {
      setValidationError('El número de factura o documento de remisión es obligatorio');
      return;
    }
    setValidationError(null);
    const remainsPending = receivedItems.some(
      (item: ReceivedItem) => (item.pending_packages - item.receiving_packages) > 0 ||
               (item.pending_units - item.receiving_units) > 0
    );
    setIsFullyReceived(!remainsPending);
    setShowConfirmModal(true);
  };

  const handleFinalSubmit = () => {
    setShowConfirmModal(false);
    receiveMutation.mutate({
      received_items: receivedItems
        .filter((item: ReceivedItem) => item.receiving_packages > 0 || item.receiving_units > 0)
        .map((item: ReceivedItem) => ({
          detail_id: item.detail_id,
          package_quantity: item.receiving_packages,
          loose_units: item.receiving_units,
          batch_number: item.batch_number || null,
          manufacture_date: item.manufacture_date || null,
          expiry_date: item.expiry_date || null,
        })),
      invoice_number: invoiceNumber,
      notes,
    });
  };

  const calculateTotalReceiving = () =>
    receivedItems.reduce((total: number, item: ReceivedItem) =>
      total + (item.receiving_packages * item.units_per_package) + item.receiving_units, 0);

  // --- Render states ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-600">Cargando orden de compra...</span>
      </div>
    );
  }

  if (isError || !order) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/purchase-orders')}
          className="mb-4 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Órdenes de Compra
        </Button>
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

      {/* Validation Error */}
      {validationError && (
        <Alert key={validationError} variant="error" dismissible>
          {validationError}
        </Alert>
      )}

      {/* Mutation Error (shown below header via toast; this also catches redirect-type errors) */}

      {/* Order Info */}
      <Card className="bg-primary-50 border-primary-200">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-primary-700">Fecha de Orden</p>
            <p className="font-medium text-primary-900">
              {formatDateShort(order.order_date)}
            </p>
          </div>
          <div>
            <p className="text-sm text-primary-700">Almacén Destino</p>
            <p className="font-medium text-primary-900">{order.warehouse.name}</p>
          </div>
          <div>
            <p className="text-sm text-primary-700">Total Orden</p>
            <p className="font-medium text-primary-900">{formatMoney(order.total, order.currency)}</p>
          </div>
          <div>
            <p className="text-sm text-primary-700">Estado</p>
            <p className="font-medium text-primary-900">{ORDER_STATUS_LABEL[order.status] || order.status}</p>
          </div>
        </div>
      </Card>

      {/* Reception Info */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de Recepción</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Factura/Remisión <span className="text-red-500">*</span>
            </label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: F-2024-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas de Recepción
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
      </Card>

      {/* Receiving Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Productos a Recibir</h2>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-indigo-500"
            onClick={handleReceiveAll}
            title="Llenar todos los campos con las cantidades pendientes"
          >
            <CheckCircle className="w-4 h-4" />
            Recibir Todo
          </Button>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ordenado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ya Recibido</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-primary-50">
                  Recibir Ahora
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {receivedItems.map((item, index) => (
                <tr
                  key={index}
                  className={item.pending_packages === 0 && item.pending_units === 0 ? 'bg-gray-50' : ''}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                    <div className="text-xs text-gray-500">{item.presentation_name}</div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900">
                    {item.ordered_packages}p + {item.ordered_units}u
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {item.received_packages + item.receiving_packages}p + {item.received_units + item.receiving_units}u
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-medium ${
                      (item.pending_packages - item.receiving_packages) === 0 &&
                      (item.pending_units - item.receiving_units) === 0
                        ? 'text-gray-900'
                        : 'text-orange-600'
                    }`}>
                      {item.pending_packages - item.receiving_packages}p + {item.pending_units - item.receiving_units}u
                    </span>
                  </td>
                  <td className="px-4 py-3 bg-primary-50">
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max={item.pending_packages}
                          value={item.receiving_packages}
                          onChange={(e) => updateReceivingItem(index, 'receiving_packages', e.target.value)}
                          className="w-20 px-3 py-1.5 text-sm text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none disabled:bg-gray-100"
                          disabled={item.pending_packages === 0}
                        />
                        <span className="text-sm font-medium text-gray-600">pqte</span>
                      </div>
                      <span className="text-gray-400 font-bold">+</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max={item.pending_units}
                          value={item.receiving_units}
                          onChange={(e) => updateReceivingItem(index, 'receiving_units', e.target.value)}
                          className="w-20 px-3 py-1.5 text-sm text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none disabled:bg-gray-100"
                          disabled={item.pending_units === 0}
                        />
                        <span className="text-sm font-medium text-gray-600">unids</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Total de unidades a recibir:{' '}
            <span className="font-semibold text-gray-900">{calculateTotalReceiving()}</span>
          </span>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate('/purchase-orders')}
              disabled={receiveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="success"
              onClick={handleReceive}
              disabled={receiveMutation.isPending || calculateTotalReceiving() === 0}
              loading={receiveMutation.isPending}
            >
              <CheckCircle className="w-4 h-4" />
              {receiveMutation.isPending ? 'Procesando...' : 'Confirmar Recepción'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Help */}
      <Alert variant="warning">
        <p className="font-medium mb-1">Instrucciones:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Ingrese las cantidades que está recibiendo ahora (puede ser parcial)</li>
          <li>No puede recibir más de lo que está pendiente</li>
          <li>Los costos de los productos se actualizarán automáticamente según la orden</li>
        </ul>
      </Alert>

      {/* Confirmation Modal */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title={isFullyReceived ? 'Confirmar Recepción Completa' : 'Confirmar Recepción Incompleta'}
        size="md"
      >
        <div className="space-y-4">
          <Alert variant={isFullyReceived ? 'success' : 'warning'}>
            {isFullyReceived
              ? '¿Deseas formalizar la recepción total de este pedido? Todos los ítems quedarán marcados como recibidos y el inventario se actualizará.'
              : 'Estás registrando una entrega parcial. Quedarán productos pendientes para una futura recepción.'
            }
          </Alert>

          {!isFullyReceived && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardText className="w-4 h-4" />
                  Razón de la recepción incompleta <span className="text-red-500">*</span>
                </div>
                <span className="text-xs text-gray-500 font-normal">
                  Indica por qué no se recibió el pedido completo (falta de stock, averías, etc.)
                </span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ej: El proveedor no envió el producto X por falta de stock..."
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button
              variant="secondary"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant={isFullyReceived ? 'success' : 'primary'}
              onClick={handleFinalSubmit}
              disabled={!isFullyReceived && !notes.trim()}
            >
              <CheckCircle className="w-4 h-4" />
              Confirmar Recepción
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PurchaseOrderReceivePage;
