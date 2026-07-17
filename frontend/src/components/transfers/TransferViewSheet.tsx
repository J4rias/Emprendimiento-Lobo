import React from 'react';
import { Check, Prohibit, ArrowRight } from '@phosphor-icons/react';
import { Sheet, Badge, Button } from '../ui';
import type { BadgeVariant } from '../ui';
import { formatDate } from '../../utils/formatUtils';

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  pending:   { label: 'Pendiente',  variant: 'warning' },
  completed: { label: 'Completada', variant: 'success' },
  cancelled: { label: 'Cancelada',  variant: 'error' },
};

interface TransferDetail {
  product?: { name?: string; sku?: string };
  presentation?: { name?: string };
  package_quantity?: number;
  loose_units?: number;
  quantity_requested?: number;
  [key: string]: unknown;
}

interface TransferPerson {
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

interface TransferWarehouse {
  name?: string;
  [key: string]: unknown;
}

interface Transfer {
  transfer_number?: string;
  originWarehouse?: TransferWarehouse;
  destinationWarehouse?: TransferWarehouse;
  transfer_date?: string;
  status?: string;
  requester?: TransferPerson;
  receiver?: TransferPerson | null;
  notes?: string;
  details?: TransferDetail[];
  [key: string]: unknown;
}

interface TransferViewSheetProps {
  open: boolean;
  onClose: () => void;
  transfer: Transfer | null;
  hasPermission: (permission: string) => boolean;
  onReceive: (transfer: Transfer) => void;
  onCancel: (transfer: Transfer) => void;
}

const TransferViewSheet: React.FC<TransferViewSheetProps> = ({ open, onClose, transfer, hasPermission, onReceive, onCancel }) => {
  if (!transfer) return null;

  const statusKey = transfer.status as string | undefined;
  const statusConfig = statusKey ? STATUS_CONFIG[statusKey] : undefined;

  return (
    <Sheet open={open} onClose={onClose} title={`Transferencia ${transfer.transfer_number ?? ''}`} size="xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <span>{transfer.originWarehouse?.name ?? ''}</span>
            <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
            <span>{transfer.destinationWarehouse?.name ?? ''}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(transfer.transfer_date ?? null)}
          </p>
        </div>
        <Badge variant={statusConfig?.variant} className="shrink-0">
          {statusConfig?.label || transfer.status || ''}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Info */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Solicitado por</p>
              <p className="font-medium text-gray-900">
                {[transfer.requester?.first_name, transfer.requester?.last_name].filter(Boolean).join(' ') || '—'}
              </p>
            </div>
            {transfer.receiver && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Recibido por</p>
                <p className="font-medium text-gray-900">
                  {[transfer.receiver?.first_name, transfer.receiver?.last_name].filter(Boolean).join(' ')}
                </p>
              </div>
            )}
          </div>
        </section>

        {transfer.notes && (
          <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 text-sm text-gray-700">
            <span className="font-medium text-gray-500">Notas: </span>{String(transfer.notes)}
          </div>
        )}

        {/* Productos */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Productos ({transfer.details?.length || 0})
          </h4>
          <div className="space-y-2">
            {transfer.details?.map((d: TransferDetail, i: number) => (
              <div key={i} className="bg-white rounded-lg px-4 py-3 border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.product?.name ?? ''}</p>
                    <p className="text-xs text-gray-500">SKU: {d.product?.sku ?? ''}</p>
                    {d.presentation && (
                      <p className="text-xs text-gray-500">
                        {d.presentation.name ?? ''} · {d.package_quantity || 0} pqt + {d.loose_units || 0} uds sueltas
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-primary-600 shrink-0 ml-3">
                    {d.quantity_requested ?? 0} uds
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
          {transfer.status === 'pending' && (
            <>
              {hasPermission('inventory.receive') && (
                <Button variant="success" onClick={() => { onClose(); onReceive(transfer); }} className="flex-1">
                  <Check className="w-4 h-4" /> Recibir
                </Button>
              )}
              {hasPermission('inventory.transfer') && (
                <Button variant="danger-outline" onClick={() => { onClose(); onCancel(transfer); }} className="flex-1">
                  <Prohibit className="w-4 h-4" /> Cancelar
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default TransferViewSheet;
