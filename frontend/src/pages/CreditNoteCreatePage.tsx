import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle } from '@phosphor-icons/react';
import { creditNoteService } from '../services/api/creditNoteService';
import { saleService } from '../services/api/saleService';
import { Alert, Button, Card, Input, Select, Textarea } from '../components/ui';
import { formatUSD, formatDateShort } from '../utils/formatUtils';

interface ReturnItem {
  sale_detail_id: number;
  product_name: string;
  presentation_name: string;
  units_per_package: number;
  sold_packages: number;
  sold_units: number;
  total_units_sold: number;
  return_packages: number;
  return_units: number;
  return_to_stock: boolean;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  selected: boolean;
}

interface SaleDetailData {
  id: number;
  product: { name: string };
  presentation: { name: string; units_per_package: number };
  package_quantity: number;
  loose_units: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
}

interface SaleData {
  id: number;
  sale_number: string;
  sale_date: string;
  status: string;
  total: number;
  customer?: { name: string } | null;
  details: SaleDetailData[];
}

const CreditNoteCreatePage = () => {
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [saleNumber, setSaleNumber] = useState('');
  const [sale, setSale] = useState<SaleData | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  const [formData, setFormData] = useState({
    reason: 'return',
    reason_description: '',
    type: 'partial',
    refund_method: 'none',
    refund_amount: '',
    refund_reference: '',
    notes: '',
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const searchMutation = useMutation({
    mutationFn: (num: string) => saleService.getBySaleNumber(num),
    onSuccess: (response: { data?: SaleData }) => {
      const saleData = response.data;
      if (!saleData) {
        setError('Venta no encontrada');
        setSale(null);
        setReturnItems([]);
        return;
      }
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
      setError(null);
      setSale(saleData);
      setReturnItems(
        saleData.details.map((detail: SaleDetailData) => ({
          sale_detail_id: detail.id,
          product_name: detail.product.name,
          presentation_name: detail.presentation.name,
          units_per_package: detail.presentation.units_per_package,
          sold_packages: detail.package_quantity,
          sold_units: detail.loose_units,
          total_units_sold:
            detail.package_quantity * detail.presentation.units_per_package + detail.loose_units,
          return_packages: 0,
          return_units: 0,
          return_to_stock: true,
          unit_price: detail.unit_price,
          discount_percent: detail.discount_percent,
          tax_percent: detail.tax_percent,
          selected: false,
        }))
      );
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Error al buscar la venta');
      setSale(null);
      setReturnItems([]);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => creditNoteService.create(data),
    onSuccess: () => {
      toast.success('Nota de crédito creada exitosamente');
      navigate('/credit-notes');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Error al crear la nota de crédito');
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSearch = () => {
    if (!saleNumber.trim()) {
      setError('Ingrese un número de venta');
      return;
    }
    setError(null);
    searchMutation.mutate(saleNumber);
  };

  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: string | number | boolean) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated: ReturnItem = { ...item, [field]: value } as ReturnItem;
        if ((field === 'return_packages' || field === 'return_units') && Number(value) > 0) {
          updated.selected = true;
        }
        if (field === 'return_packages') {
          const qty = parseInt(String(value)) || 0;
          if (qty > item.sold_packages) updated.return_packages = item.sold_packages;
        }
        if (field === 'return_units') {
          const qty = parseInt(String(value)) || 0;
          if (qty > item.sold_units) updated.return_units = item.sold_units;
        }
        return updated;
      })
    );
  };

  const toggleItemSelection = (index: number) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const selected = !item.selected;
        if (selected && item.return_packages === 0 && item.return_units === 0) {
          return { ...item, selected, return_packages: item.sold_packages, return_units: item.sold_units };
        }
        return { ...item, selected };
      })
    );
  };

  const calculateTotal = () => {
    let subtotal = 0;
    let tax_amount = 0;
    returnItems.forEach((item) => {
      if (item.selected && (item.return_packages > 0 || item.return_units > 0)) {
        const total_units = item.return_packages * item.units_per_package + item.return_units;
        const line_sub = item.unit_price * total_units;
        const line_discount = line_sub * (item.discount_percent / 100);
        const line_tax = (line_sub - line_discount) * (item.tax_percent / 100);
        subtotal += line_sub - line_discount;
        tax_amount += line_tax;
      }
    });
    return { subtotal, tax_amount, total: subtotal + tax_amount };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedItems = returnItems.filter(
      (item) => item.selected && (item.return_packages > 0 || item.return_units > 0)
    );
    if (selectedItems.length === 0) {
      setError('Debe seleccionar al menos un producto para devolver');
      return;
    }
    if (formData.refund_method !== 'none') {
      const refundAmount = parseFloat(formData.refund_amount) || 0;
      if (refundAmount > totals.total) {
        setError('El monto de reembolso no puede ser mayor al total de la nota de crédito');
        return;
      }
    }
    setError(null);
    if (!sale) return;
    createMutation.mutate({
      sale_id: sale.id,
      reason: formData.reason,
      reason_description: formData.reason_description || null,
      type: formData.type,
      refund_method: formData.refund_method,
      refund_amount: formData.refund_method !== 'none' ? parseFloat(formData.refund_amount) || 0 : 0,
      refund_reference: formData.refund_reference || null,
      notes: formData.notes || null,
      items: selectedItems.map((item) => ({
        sale_detail_id: item.sale_detail_id,
        package_quantity_returned: item.return_packages,
        loose_units_returned: item.return_units,
        return_to_stock: item.return_to_stock,
      })),
    });
  };

  const totals = calculateTotal();
  const selectedCount = returnItems.filter(
    (i) => i.selected && (i.return_packages > 0 || i.return_units > 0)
  ).length;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Cabecera ──────────────────────────────────────────────────────────── */}
      <div>
        <Button variant="ghost" onClick={() => navigate('/credit-notes')} className="mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Volver a Notas de Crédito
        </Button>
        <h1 className="text-2xl font-bold text-gray-800">Crear Nota de Crédito</h1>
        <p className="text-gray-500 mt-1">Registrar devolución de productos</p>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {error && (
        <Alert variant="error" className="mb-4" dismissible>
          {error}
        </Alert>
      )}

      {/* ── Buscar venta ──────────────────────────────────────────────────────── */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Buscar Venta</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Número de venta (ej: VEN-20240101-0001)"
              value={saleNumber}
              onChange={(e) => setSaleNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} loading={searchMutation.isPending}>
            Buscar
          </Button>
        </div>
      </Card>

      {/* ── Contenido (solo con venta cargada) ───────────────────────────────── */}
      {sale && (
        <>
          {/* ── Info de la venta ── */}
          <Card className="bg-primary-50 border-primary-200 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-primary-700">Número de Venta</p>
                <p className="font-medium text-primary-900">{sale.sale_number}</p>
              </div>
              <div>
                <p className="text-primary-700">Fecha</p>
                <p className="font-medium text-primary-900">
                  {formatDateShort(sale.sale_date)}
                </p>
              </div>
              <div>
                <p className="text-primary-700">Cliente</p>
                <p className="font-medium text-primary-900">{sale.customer?.name || 'Cliente General'}</p>
              </div>
              <div>
                <p className="text-primary-700">Total Venta</p>
                <p className="font-medium text-primary-900">{formatUSD(sale.total)}</p>
              </div>
            </div>
          </Card>

          <form onSubmit={handleSubmit}>
            {/* ── Información de la devolución ── */}
            <Card>
              <h2 className="text-base font-semibold text-gray-900 mb-4">Información de la Devolución</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Motivo *" value={formData.reason} onChange={set('reason')} required>
                  <option value="return">Devolución</option>
                  <option value="discount">Descuento</option>
                  <option value="error">Error en la venta</option>
                  <option value="other">Otro</option>
                </Select>

                <Select label="Tipo de Devolución *" value={formData.type} onChange={set('type')} required>
                  <option value="partial">Parcial</option>
                  <option value="full">Total</option>
                </Select>

                <div className="md:col-span-2">
                  <Textarea
                    label="Descripción del Motivo"
                    value={formData.reason_description}
                    onChange={set('reason_description')}
                    rows={2}
                  />
                </div>

                <Select
                  label="Método de Reembolso"
                  value={formData.refund_method}
                  onChange={set('refund_method')}
                >
                  <option value="none">Sin Reembolso</option>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="credit_balance">Saldo a Favor del Cliente</option>
                </Select>

                {formData.refund_method !== 'none' && (
                  <>
                    <Input
                      label="Monto a Reembolsar"
                      type="number"
                      step="0.01"
                      min="0"
                      max={totals.total}
                      value={formData.refund_amount}
                      onChange={set('refund_amount')}
                    />
                    <div className="md:col-span-2">
                      <Input
                        label="Referencia de Reembolso"
                        value={formData.refund_reference}
                        onChange={set('refund_reference')}
                        placeholder="Número de cheque, transferencia, etc."
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <Textarea
                    label="Notas Adicionales"
                    value={formData.notes}
                    onChange={set('notes')}
                    rows={2}
                  />
                </div>
              </div>
            </Card>

            {/* ── Productos a devolver ── */}
            <div className="rounded-lg border border-gray-200 bg-white mb-6 overflow-hidden">
              <div className="p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Productos a Devolver</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sel.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vendido</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-primary-50">A Devolver</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Al Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {returnItems.map((item, index) => (
                        <tr key={index} className={item.selected ? 'bg-primary-50' : 'bg-white'}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(index)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-200"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.presentation_name}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            <div>{item.sold_packages}p + {item.sold_units}u</div>
                            <div className="text-xs text-gray-500">({item.total_units_sold} un.)</div>
                          </td>
                          <td className="px-4 py-3 bg-primary-50">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number" min="0" max={item.sold_packages}
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
                                  type="number" min="0" max={item.sold_units}
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
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-200 disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Resumen + acciones ── */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-gray-600 mt-1">
                    Productos seleccionados: <span className="font-semibold text-gray-900">{selectedCount}</span>
                  </p>
                  <div className="space-y-0.5 text-right text-sm">
                    <div>
                      <span className="text-gray-600">Subtotal: </span>
                      <span className="font-medium">{formatUSD(totals.subtotal)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Impuestos: </span>
                      <span className="font-medium">{formatUSD(totals.tax_amount)}</span>
                    </div>
                    <div className="text-lg font-bold">
                      <span className="text-gray-900">Total: </span>
                      <span className="text-primary-600">{formatUSD(totals.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate('/credit-notes')}
                    disabled={createMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    loading={createMutation.isPending}
                    disabled={selectedCount === 0}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Crear Nota de Crédito
                  </Button>
                </div>
              </div>
            </div>
          </form>

          {/* ── Instrucciones ─────────────────────────────────────────────────── */}
          <Alert variant="warning" title="Instrucciones">
            <ul className="list-disc list-inside space-y-1 mt-1 text-sm">
              <li>Seleccione los productos a devolver marcando el checkbox</li>
              <li>Ingrese las cantidades exactas a devolver (no puede exceder lo vendido)</li>
              <li>Marque "Al Stock" si desea que el producto vuelva al inventario</li>
              <li>La nota de crédito quedará en estado "Borrador" hasta ser aprobada</li>
              <li>Al aprobar la nota de crédito, se actualizará automáticamente el inventario</li>
            </ul>
          </Alert>
        </>
      )}
    </div>
  );
};

export default CreditNoteCreatePage;
