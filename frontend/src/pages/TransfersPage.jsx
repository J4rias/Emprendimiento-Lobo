import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, Plus, Package, Check, Ban, Eye, ArrowRight } from 'lucide-react';
import { transferService } from '../services/api/transferService';
import { warehouseService } from '../services/api/warehouseService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Modal, Button, Badge, Textarea, Spinner, Alert, ConfirmDialog, Card } from '../components/ui';
import TransferFormModal from '../components/transfers/TransferFormModal';

const STATUS_CONFIG = {
  pending:   { label: 'Pendiente',   variant: 'warning' },
  completed: { label: 'Completada',  variant: 'success' },
  cancelled: { label: 'Cancelada',   variant: 'error' },
};

const TAB_OPTS = [
  { key: 'pending',   label: 'Pendientes' },
  { key: 'completed', label: 'Completadas' },
  { key: 'all',       label: 'Todas' },
];

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}
  >
    {children}
  </button>
);

const TransfersPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [viewTransfer, setViewTransfer] = useState(null);     // for detail modal
  const [confirmReceive, setConfirmReceive] = useState(null); // for receive ConfirmDialog
  const [cancelTarget, setCancelTarget] = useState(null);     // for cancel Modal
  const [cancelReason, setCancelReason] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // --- Queries ---
  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['transfers', activeTab],
    queryFn: () => {
      const params = activeTab === 'all' ? {} : { status: activeTab };
      return transferService.getAll(params);
    },
    staleTime: 30_000,
  });
  const transfers = transfersData?.data?.transfers || [];

  // --- Mutations ---
  const receiveMutation = useMutation({
    mutationFn: (id) => transferService.receive(id),
    onSuccess: () => {
      toast.success('Transferencia recibida exitosamente');
      setConfirmReceive(null);
      setViewTransfer(null);
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al recibir la transferencia'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => transferService.cancel(id, reason),
    onSuccess: () => {
      toast.success('Transferencia cancelada exitosamente');
      setCancelTarget(null);
      setCancelReason('');
      setViewTransfer(null);
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al cancelar la transferencia'),
  });

  const createMutation = useMutation({
    mutationFn: (formData) => transferService.create(formData),
    onSuccess: () => {
      toast.success('Transferencia creada exitosamente');
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al crear la transferencia');
      throw err; // re-throw so TransferFormModal can handle it
    },
  });

  const handleViewDetails = async (transfer) => {
    try {
      const response = await transferService.getById(transfer.id);
      setViewTransfer(response.data);
    } catch {
      toast.error('Error al cargar los detalles');
    }
  };

  const openCancel = (transfer) => {
    setCancelTarget(transfer);
    setCancelReason('');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transferencias de Inventario</h1>
          <p className="text-gray-500 mt-1">Gestiona las transferencias entre almacenes</p>
        </div>
        {hasPermission('inventory.transfer') && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            Nueva Transferencia
          </Button>
        )}
      </div>

      {/* Tab + Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {TAB_OPTS.map(t => (
              <TabBtn key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </TabBtn>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <Spinner size="lg" />
              <p className="text-gray-500">Cargando transferencias...</p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                No hay transferencias{activeTab !== 'all' && ` ${activeTab === 'pending' ? 'pendientes' : 'completadas'}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Número', 'Fecha', 'Ruta', 'Items', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transfers.map((transfer) => {
                    const cfg = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={transfer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                          {transfer.transfer_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(transfer.transfer_date).toLocaleDateString('es-VE')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          <div className="flex items-center gap-1.5">
                            <span>{transfer.originWarehouse?.name}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{transfer.destinationWarehouse?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {transfer.details?.length || 0} producto{(transfer.details?.length || 0) !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(transfer)}
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                              Ver
                            </Button>
                            {transfer.status === 'pending' && hasPermission('inventory.receive') && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setConfirmReceive(transfer)}
                              >
                                <Check className="w-4 h-4" />
                                Recibir
                              </Button>
                            )}
                            {transfer.status === 'pending' && hasPermission('inventory.transfer') && (
                              <Button
                                variant="danger-outline"
                                size="sm"
                                onClick={() => openCancel(transfer)}
                              >
                                <Ban className="w-4 h-4" />
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      <Modal
        open={!!viewTransfer}
        onClose={() => setViewTransfer(null)}
        title={`Transferencia ${viewTransfer?.transfer_number || ''}`}
        size="lg"
      >
        {viewTransfer && (
          <div className="space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Ruta</p>
                <div className="flex items-center gap-1.5 font-medium text-gray-900">
                  <span>{viewTransfer.originWarehouse?.name}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span>{viewTransfer.destinationWarehouse?.name}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Fecha</p>
                <p className="font-medium text-gray-900">
                  {new Date(viewTransfer.transfer_date).toLocaleString('es-VE')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Estado</p>
                <Badge variant={STATUS_CONFIG[viewTransfer.status]?.variant}>
                  {STATUS_CONFIG[viewTransfer.status]?.label || viewTransfer.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Solicitado por</p>
                <p className="font-medium text-gray-900">
                  {[viewTransfer.requester?.first_name, viewTransfer.requester?.last_name].filter(Boolean).join(' ') || '—'}
                </p>
              </div>
              {viewTransfer.receiver && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Recibido por</p>
                  <p className="font-medium text-gray-900">
                    {[viewTransfer.receiver?.first_name, viewTransfer.receiver?.last_name].filter(Boolean).join(' ')}
                  </p>
                </div>
              )}
            </div>

            {viewTransfer.notes && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">
                <span className="font-medium text-gray-500">Notas: </span>{viewTransfer.notes}
              </div>
            )}

            {/* Products */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Productos ({viewTransfer.details?.length || 0})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {viewTransfer.details?.map((detail, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{detail.product?.name}</p>
                        <p className="text-xs text-gray-500">SKU: {detail.product?.sku}</p>
                        {detail.presentation && (
                          <p className="text-xs text-gray-500">
                            {detail.presentation.name} · {detail.package_quantity || 0} pqt + {detail.loose_units || 0} uds sueltas
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-blue-600">
                        {detail.quantity_requested} uds
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions if pending */}
            {viewTransfer.status === 'pending' && (
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                {hasPermission('inventory.receive') && (
                  <Button
                    variant="success"
                    onClick={() => {
                      setViewTransfer(null);
                      setConfirmReceive(viewTransfer);
                    }}
                  >
                    <Check className="w-4 h-4" />
                    Recibir Transferencia
                  </Button>
                )}
                {hasPermission('inventory.transfer') && (
                  <Button
                    variant="danger-outline"
                    onClick={() => {
                      setViewTransfer(null);
                      openCancel(viewTransfer);
                    }}
                  >
                    <Ban className="w-4 h-4" />
                    Cancelar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Receive ConfirmDialog ── */}
      <ConfirmDialog
        open={!!confirmReceive}
        title="Confirmar Recepción"
        message={
          confirmReceive
            ? `¿Confirmas la recepción de la transferencia ${confirmReceive.transfer_number}? El inventario se actualizará automáticamente.`
            : ''
        }
        confirmLabel="Confirmar Recepción"
        variant="success"
        loading={receiveMutation.isPending}
        onConfirm={() => receiveMutation.mutate(confirmReceive.id)}
        onCancel={() => setConfirmReceive(null)}
      />

      {/* ── Cancel Modal ── */}
      <Modal
        open={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        title="Cancelar Transferencia"
        size="sm"
      >
        <div className="space-y-4">
          <Alert variant="warning">
            Esta acción restaurará el inventario al almacén de origen. No se puede deshacer.
          </Alert>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de cancelación <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Describe el motivo de la cancelación..."
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setCancelTarget(null); setCancelReason(''); }}
              disabled={cancelMutation.isPending}
            >
              Volver
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason })}
            >
              <Ban className="w-4 h-4" />
              Confirmar Cancelación
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Create Transfer Modal ── */}
      <TransferFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(data) => createMutation.mutateAsync(data)}
      />
    </div>
  );
};

export default TransfersPage;
