import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingCart,
  MessageCircle,
  Send,
  Globe,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { preOrderService } from '../services/api/preOrderService';
import { toast } from 'sonner';

const PreOrdersPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: '',
    channel: '',
    page: 1,
    limit: 20,
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['pre-orders', filters],
    queryFn: () => preOrderService.getAll(filters),
    keepPreviousData: true,
    staleTime: 15_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['pre-orders-stats'],
    queryFn: () => preOrderService.getStats(),
    staleTime: 30_000,
  });

  const preOrders = ordersData?.data || [];
  const pagination = ordersData?.pagination || { total: 0, totalPages: 0, page: 1 };
  const stats = statsData?.data || { pending: 0, approved: 0, today: 0 };

  const approveMutation = useMutation({
    mutationFn: (id) => preOrderService.approve(id),
    onSuccess: () => {
      toast.success('Pre-pedido aprobado');
      queryClient.invalidateQueries({ queryKey: ['pre-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pre-orders-stats'] });
      setShowDetail(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al aprobar'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => preOrderService.reject(id),
    onSuccess: () => {
      toast.success('Pre-pedido rechazado');
      queryClient.invalidateQueries({ queryKey: ['pre-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pre-orders-stats'] });
      setShowDetail(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al rechazar'),
  });

  const convertMutation = useMutation({
    mutationFn: (id) => preOrderService.convert(id, { sale_type: 'cash', payment_lines: [] }),
    onSuccess: (data) => {
      toast.success(`Venta ${data.data?.sale?.sale_number} creada`);
      queryClient.invalidateQueries({ queryKey: ['pre-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pre-orders-stats'] });
      setShowDetail(false);
      setShowConvertConfirm(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al convertir'),
  });

  const getStatusBadge = (status) => {
    const badges = {
      pending: { cls: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendiente' },
      approved: { cls: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Aprobado' },
      rejected: { cls: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rechazado' },
      converted: { cls: 'bg-green-100 text-green-800', icon: ShoppingCart, label: 'Convertido' },
      expired: { cls: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Expirado' },
    };
    const b = badges[status] || badges.expired;
    const Icon = b.icon;
    return (
      <span className={`px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${b.cls}`}>
        <Icon className="w-3 h-3 mr-1" />
        {b.label}
      </span>
    );
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'messenger': return <MessageCircle className="w-4 h-4 text-blue-500" title="Messenger" />;
      case 'telegram': return <Send className="w-4 h-4 text-sky-500" title="Telegram" />;
      case 'web': return <Globe className="w-4 h-4 text-gray-500" title="Web" />;
      default: return null;
    }
  };

  const openDetail = async (order) => {
    try {
      const result = await preOrderService.getById(order.id);
      setSelectedOrder(result.data);
      setShowDetail(true);
    } catch {
      toast.error('Error al cargar detalle');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pre-Pedidos</h1>
          <p className="text-gray-600 mt-1">Pedidos creados por el bot de ventas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-sm text-yellow-600">Pendientes</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">{stats.approved}</div>
          <div className="text-sm text-blue-600">Aprobados</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-700">{stats.today}</div>
          <div className="text-sm text-gray-600">Hoy</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.status}
          onChange={(e) => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobado</option>
          <option value="rejected">Rechazado</option>
          <option value="converted">Convertido</option>
          <option value="expired">Expirado</option>
        </select>
        <select
          value={filters.channel}
          onChange={(e) => setFilters(f => ({ ...f, channel: e.target.value, page: 1 }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos los canales</option>
          <option value="messenger">Messenger</option>
          <option value="telegram">Telegram</option>
          <option value="web">Web</option>
        </select>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['pre-orders'] });
            queryClient.invalidateQueries({ queryKey: ['pre-orders-stats'] });
          }}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
              ) : preOrders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No hay pre-pedidos</td></tr>
              ) : preOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{order.code}</td>
                  <td className="px-4 py-3">{getChannelIcon(order.channel)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {order.customer?.name || order.customerName || 'Sin cliente'}
                    {order.customerPhone && (
                      <div className="text-xs text-gray-400">{order.customerPhone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{order.details?.length || 0}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    ${parseFloat(order.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(order.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openDetail(order)}
                      className="text-primary-600 hover:text-primary-800"
                      title="Ver detalle"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              {pagination.total} pre-pedidos
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">{pagination.page} / {pagination.totalPages}</span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedOrder.code}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {getChannelIcon(selectedOrder.channel)}
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                </div>
                <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Customer info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Cliente</h3>
                <div className="text-sm">
                  <div className="font-medium">{selectedOrder.customer?.name || selectedOrder.customerName || 'Sin cliente'}</div>
                  {selectedOrder.customerPhone && <div className="text-gray-500">{selectedOrder.customerPhone}</div>}
                  {selectedOrder.customer?.email && <div className="text-gray-500">{selectedOrder.customer.email}</div>}
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-700 mb-1">Notas del bot</h3>
                  <p className="text-sm text-blue-600 whitespace-pre-wrap">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Productos</h3>
                <div className="border rounded-lg divide-y">
                  {selectedOrder.details?.map((detail) => (
                    <div key={detail.id} className="p-3 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">{detail.product?.name}</div>
                        <div className="text-xs text-gray-500">
                          {detail.presentation?.name} &middot; {parseFloat(detail.quantity)} {detail.isUnit ? 'uds' : 'paq'}
                        </div>
                      </div>
                      <div className="text-sm font-medium">${parseFloat(detail.total).toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="p-3 flex justify-between items-center bg-gray-50 font-bold">
                    <div>Total</div>
                    <div>${parseFloat(selectedOrder.total).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Converted sale info */}
              {selectedOrder.convertedSale && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-700 mb-1">Venta generada</h3>
                  <p className="text-sm text-green-600">
                    {selectedOrder.convertedSale.sale_number} — Total: ${parseFloat(selectedOrder.convertedSale.total).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                {selectedOrder.status === 'pending' && (
                  <>
                    <button
                      onClick={() => rejectMutation.mutate(selectedOrder.id)}
                      disabled={rejectMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => approveMutation.mutate(selectedOrder.id)}
                      disabled={approveMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                  </>
                )}
                {selectedOrder.status === 'approved' && (
                  <button
                    onClick={() => setShowConvertConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
                  >
                    <ArrowRight className="w-4 h-4" /> Convertir a Venta
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert Confirmation */}
      {showConvertConfirm && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-bold text-gray-800">Convertir a venta</h3>
            </div>
            <p className="text-sm text-gray-600">
              Se creará una venta de contado por <strong>${parseFloat(selectedOrder.total).toFixed(2)}</strong> basada
              en el pre-pedido <strong>{selectedOrder.code}</strong>. El inventario se descontará.
            </p>
            <p className="text-xs text-gray-400">
              El cobro se registrará después en el POS o se puede editar la venta.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConvertConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => convertMutation.mutate(selectedOrder.id)}
                disabled={convertMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
              >
                {convertMutation.isPending ? 'Convirtiendo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreOrdersPage;
