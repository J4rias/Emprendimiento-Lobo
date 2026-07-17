import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inventoryService } from '../../services/api/inventoryService';
import { Button, Input, Modal, Select } from '../ui';

interface Presentation {
  id?: number;
  is_default?: boolean;
  is_active?: boolean;
  units_per_package: number | string;
}

interface InventoryItem {
  product_id: number;
  warehouse_id: number;
  product?: {
    name: string;
    presentations?: Presentation[];
  };
}

const getDefaultPresentation = (item: InventoryItem | null): Presentation =>
  item?.product?.presentations?.find(p => p.is_default && p.is_active) ||
  item?.product?.presentations?.find(p => p.is_active) ||
  { units_per_package: 1 };

/**
 * Modal de ajuste individual de stock (entrada/salida en bultos + sueltas).
 * Compartido por InventoryPage e InventoryDetailPage.
 *
 * @param {object|null} item     - Registro de inventario: { product_id, warehouse_id, product: { name, presentations } }
 * @param {function}    onClose  - Cierra el modal
 * @param {function}    [onSuccess] - Callback adicional tras guardar (las queries de inventario se invalidan siempre)
 */
interface AdjustStockModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdjustStockModal({ item, onClose, onSuccess }: AdjustStockModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ type: 'add', bultos: '', unidades: '', reason: '' });

  useEffect(() => {
    if (item) setForm({ type: 'add', bultos: '', unidades: '', reason: '' });
  }, [item]);

  const adjustMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => inventoryService.adjustInventory(data as Parameters<typeof inventoryService.adjustInventory>[0]),
    onSuccess: () => {
      toast.success('Stock ajustado correctamente');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al ajustar inventario'),
  });

  const handleSubmit = () => {
    const pres = getDefaultPresentation(item);
    const unitsPerPkg = parseFloat(String(pres.units_per_package)) || 1;
    const bultos = parseFloat(form.bultos) || 0;
    const unidades = parseFloat(form.unidades) || 0;
    if ((bultos * unitsPerPkg) + unidades <= 0) {
      toast.error('Ingresa al menos una cantidad');
      return;
    }
    if (!item) return;
    adjustMutation.mutate({
      product_id: item.product_id,
      warehouse_id: item.warehouse_id,
      type: form.type,
      presentation_id: pres.id || undefined,
      package_quantity: bultos || undefined,
      loose_units: unidades || undefined,
      reason: form.reason || undefined,
    });
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={item ? `Ajustar Stock — ${item.product?.name}` : ''}
      size="sm"
    >
      {item && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <Select
              value={form.type}
              onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
            >
              <option value="add">➕ Entrada (agregar stock)</option>
              <option value="remove">➖ Salida (retirar stock)</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bultos</label>
              <Input
                type="number" min="0" step="1"
                value={form.bultos}
                onChange={(e) => setForm(f => ({ ...f, bultos: e.target.value }))}
                placeholder="0"
                className="text-center"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidades sueltas</label>
              <Input
                type="number" min="0" step="1"
                value={form.unidades}
                onChange={(e) => setForm(f => ({ ...f, unidades: e.target.value }))}
                placeholder="0"
                className="text-center"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <Input
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Ej: Compra de proveedor, pérdida..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary" className="flex-1"
              onClick={onClose}
              disabled={adjustMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              loading={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? 'Guardando...' : 'Guardar Ajuste'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
