import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Plus, Package, X, Check, Ban, Eye } from 'lucide-react';
import { transferService } from '../services/api/transferService';
import { warehouseService } from '../services/api/warehouseService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import TransferFormModal from '../components/transfers/TransferFormModal';

const TransfersPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll(),
    staleTime: 5 * 60_000,
  });
  const warehouses = warehousesData?.data || [];

  const { data: transfersData, isLoading: loading } = useQuery({
    queryKey: ['transfers', activeTab],
    queryFn: () => {
      const params = activeTab === 'all' ? {} : { status: activeTab };
      return transferService.getAll(params);
    },
    staleTime: 30_000,
  });
  const transfers = transfersData?.data?.transfers || [];

  const handleViewDetails = async (transfer) => {
    try {
      const response = await transferService.getById(transfer.id);
      setSelectedTransfer(response.data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching transfer details:', error);
      toast.error('Error al cargar los detalles');
    }
  };

  const handleReceiveTransfer = async () => {
    if (!selectedTransfer) return;

    try {
      setActionLoading(true);
      await transferService.receive(selectedTransfer.id);
      toast.success('Transferencia recibida exitosamente');
      setShowReceiveModal(false);
      setSelectedTransfer(null);
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    } catch (error) {
      console.error('Error receiving transfer:', error);
      toast.error(error.response?.data?.message || 'Error al recibir la transferencia');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!selectedTransfer) return;

    try {
      setActionLoading(true);
      await transferService.cancel(selectedTransfer.id, cancelReason);
      toast.success('Transferencia cancelada exitosamente');
      setShowCancelModal(false);
      setSelectedTransfer(null);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    } catch (error) {
      console.error('Error canceling transfer:', error);
      toast.error(error.response?.data?.message || 'Error al cancelar la transferencia');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTransfer = async (formData) => {
    try {
      const response = await transferService.create(formData);
      toast.success('Transferencia creada exitosamente');

      // Show inventory impact if available
      if (response.data?.inventory_impact) {
        const impact = response.data.inventory_impact;
        console.log('Inventory impact:', impact);
      }

      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast.error(error.response?.data?.message || 'Error al crear la transferencia');
      throw error;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      pending: 'Pendiente',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transferencias de Inventario</h1>
          <p className="text-gray-600 mt-1">Gestiona las transferencias entre almacenes</p>
        </div>
        {hasPermission('inventory.transfer') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={20} />
            Nueva Transferencia
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'pending'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'completed'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Completadas
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'all'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Todas
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Cargando transferencias...</p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">
                No hay transferencias {activeTab !== 'all' && `en estado ${activeTab === 'pending' ? 'pendiente' : 'completada'}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Número
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Origen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destino
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {transfer.transfer_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transfer.transfer_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.originWarehouse?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.destinationWarehouse?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.details?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(transfer.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleViewDetails(transfer)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Eye size={16} />
                            Ver
                          </button>
                          {transfer.status === 'pending' && hasPermission('inventory.receive') && (
                            <button 
                              onClick={() => {
                                setSelectedTransfer(transfer);
                                setShowReceiveModal(true);
                              }}
                              className="text-green-600 hover:text-green-800 flex items-center gap-1"
                            >
                              <Check size={16} />
                              Recibir
                            </button>
                          )}
                          {transfer.status === 'pending' && hasPermission('inventory.transfer') && (
                            <button 
                              onClick={() => {
                                setSelectedTransfer(transfer);
                                setShowCancelModal(true);
                              }}
                              className="text-red-600 hover:text-red-800 flex items-center gap-1"
                            >
                              <Ban size={16} />
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalles */}
      {showDetailModal && selectedTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Detalles de Transferencia</h2>
                <p className="text-gray-600 mt-1">{selectedTransfer.transfer_number}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedTransfer(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Origen</p>
                <p className="font-medium">{selectedTransfer.originWarehouse?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Destino</p>
                <p className="font-medium">{selectedTransfer.destinationWarehouse?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha</p>
                <p className="font-medium">{new Date(selectedTransfer.transfer_date).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                <div className="mt-1">{getStatusBadge(selectedTransfer.status)}</div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Solicitado por</p>
                <p className="font-medium">
                  {selectedTransfer.requester?.first_name} {selectedTransfer.requester?.last_name}
                </p>
              </div>
              {selectedTransfer.receiver && (
                <div>
                  <p className="text-sm text-gray-600">Recibido por</p>
                  <p className="font-medium">
                    {selectedTransfer.receiver?.first_name} {selectedTransfer.receiver?.last_name}
                  </p>
                </div>
              )}
            </div>

            {selectedTransfer.notes && (
              <div className="mb-6">
                <p className="text-sm text-gray-600">Notas</p>
                <p className="font-medium">{selectedTransfer.notes}</p>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Productos ({selectedTransfer.details?.length || 0})</h3>
              <div className="space-y-2">
                {selectedTransfer.details?.map((detail, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{detail.product?.name}</p>
                        <p className="text-sm text-gray-600">SKU: {detail.product?.sku}</p>
                        {detail.presentation && (
                          <p className="text-sm text-gray-600">
                            Presentación: {detail.presentation.name} 
                            ({detail.package_quantity || 0} paquetes + {detail.loose_units || 0} sueltas)
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">{detail.quantity_requested} unidades</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recibir */}
      {showReceiveModal && selectedTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">Recibir Transferencia</h2>
              <button
                onClick={() => {
                  setShowReceiveModal(false);
                  setSelectedTransfer(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                ¿Confirmas que deseas recibir la transferencia <strong>{selectedTransfer.transfer_number}</strong>?
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>De:</strong> {selectedTransfer.originWarehouse?.name}<br />
                  <strong>A:</strong> {selectedTransfer.destinationWarehouse?.name}<br />
                  <strong>Items:</strong> {selectedTransfer.details?.length || 0} productos
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReceiveModal(false);
                  setSelectedTransfer(null);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReceiveTransfer}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Confirmar Recepción
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelar */}
      {showCancelModal && selectedTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">Cancelar Transferencia</h2>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedTransfer(null);
                  setCancelReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">
                  ⚠️ Esto restaurará el inventario al almacén de origen
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Describe el motivo de la cancelación..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedTransfer(null);
                  setCancelReason('');
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={handleCancelTransfer}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Cancelando...
                  </>
                ) : (
                  <>
                    <Ban size={16} />
                    Confirmar Cancelación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Crear Transferencia */}
      <TransferFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTransfer}
      />
    </div>
  );
};

export default TransfersPage;
