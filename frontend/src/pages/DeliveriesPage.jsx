import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { deliveryService } from '../services/api/deliveryService';
import { saleService } from '../services/api/saleService';
import { toast } from 'sonner';
import {
  Plus, Eye, Truck, CheckCircle, X, Package, Clock, XCircle,
} from 'lucide-react';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Input, Modal,
  Pagination, SearchInput, Select, Table, Textarea, useTableLimit,
} from '../components/ui';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_VARIANT = {
  pending: 'warning', in_transit: 'info', delivered: 'success',
  failed: 'error',    cancelled: 'neutral',
};
const STATUS_LABEL = {
  pending: 'Pendiente', in_transit: 'En Tránsito', delivered: 'Entregada',
  failed: 'Fallida',    cancelled: 'Cancelada',
};
const DELIVERY_METHODS = {
  pickup: 'Retiro en Tienda', courier: 'Mensajería',
  own_fleet: 'Flota Propia',  shipping_company: 'Transportadora',
};

const BLANK_FORM = {
  sale_number: '',
  scheduled_date: new Date().toISOString().split('T')[0],
  delivery_address: '',
  delivery_city: '',
  delivery_state: '',
  contact_name: '',
  contact_phone: '',
  delivery_method: 'courier',
  carrier: '',
  tracking_number: '',
  notes: '',
};

const StatusBadge = ({ status }) => (
  <Badge variant={STATUS_VARIANT[status] || 'neutral'}>
    {STATUS_LABEL[status] || status}
  </Badge>
);

const DeliveriesPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useTableLimit();

  // ─── Filters & pagination ────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal]     = useState(false);
  const [viewingDelivery, setViewingDelivery] = useState(null);
  const [formData, setFormData]               = useState(BLANK_FORM);

  // State for action confirmations
  const [transitTarget, setTransitTarget] = useState(null); // id
  const [confirmTarget, setConfirmTarget] = useState(null); // id
  const [cancelTarget, setCancelTarget]   = useState(null); // delivery object
  const [cancelReason, setCancelReason]   = useState('');

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: deliveriesData, isLoading, isError: fetchError } = useQuery({
    queryKey: ['deliveries', currentPage, search, statusFilter, limit],
    queryFn: () => deliveryService.getAll({
      page: currentPage, limit,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
    staleTime: 30_000,
  });
  const deliveries  = deliveriesData?.data || [];
  const totalPages  = deliveriesData?.pagination?.totalPages || 1;
  const total       = deliveriesData?.pagination?.total || 0;

  const { data: statsData } = useQuery({
    queryKey: ['deliveries-stats'],
    queryFn:  () => deliveryService.getStats(),
    staleTime: 60_000,
  });
  const stats = statsData?.data || null;

  // ─── Invalidate helper ────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['deliveries-stats'] });
  };

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const saleRes = await saleService.getBySaleNumber(data.sale_number);
      if (!saleRes.data) throw new Error('Venta no encontrada');
      return deliveryService.create({
        sale_id:         saleRes.data.id,
        scheduled_date:  data.scheduled_date,
        delivery_address: data.delivery_address,
        delivery_city:   data.delivery_city   || null,
        delivery_state:  data.delivery_state  || null,
        contact_name:    data.contact_name    || null,
        contact_phone:   data.contact_phone   || null,
        delivery_method: data.delivery_method,
        carrier:         data.carrier         || null,
        tracking_number: data.tracking_number || null,
        notes:           data.notes           || null,
      });
    },
    onSuccess: () => {
      toast.success('Entrega creada exitosamente');
      setShowCreateModal(false);
      setFormData(BLANK_FORM);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || 'Error al crear la entrega'),
  });

  const transitMutation = useMutation({
    mutationFn: (id) => deliveryService.markAsInTransit(id),
    onSuccess: () => {
      toast.success('Entrega marcada como en tránsito');
      setTransitTarget(null);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar la entrega'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id) => deliveryService.confirm(id, {
      delivery_date: new Date().toISOString().split('T')[0],
    }),
    onSuccess: () => {
      toast.success('Entrega confirmada exitosamente');
      setConfirmTarget(null);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al confirmar la entrega'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => deliveryService.cancel(id, reason),
    onSuccess: () => {
      toast.success('Entrega cancelada exitosamente');
      setCancelTarget(null);
      setCancelReason('');
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al cancelar la entrega'),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const set = (f) => (e) => setFormData(p => ({ ...p, [f]: e.target.value }));

  const handleSearchChange  = (v) => { setSearch(v);            setCurrentPage(1); };
  const handleStatusChange  = (e) => { setStatusFilter(e.target.value); setCurrentPage(1); };

  const handleViewDelivery = async (delivery) => {
    try {
      const response = await deliveryService.getById(delivery.id);
      setViewingDelivery(response.data);
      setShowViewModal(true);
    } catch {
      toast.error('Error al cargar el detalle de la entrega');
    }
  };

  // ─── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'delivery_number',
      header: 'Número',
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.delivery_number}</div>
          <div className="text-xs text-gray-500">
            {new Date(row.scheduled_date).toLocaleDateString('es-VE')}
          </div>
        </div>
      ),
    },
    {
      key: 'sale',
      header: 'Venta',
      render: (_, row) => (
        <div>
          <div className="font-medium text-blue-600">{row.sale?.sale_number}</div>
          <div className="text-xs text-gray-500">
            {new Date(row.sale?.sale_date).toLocaleDateString('es-VE')}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.customer?.name}</div>
          <div className="text-xs text-gray-500">{row.customer?.phone}</div>
        </div>
      ),
    },
    {
      key: 'delivery_address',
      header: 'Dirección',
      render: (v) => (
        <div className="text-sm text-gray-600 max-w-xs truncate" title={v}>{v}</div>
      ),
    },
    {
      key: 'delivery_method',
      header: 'Método',
      render: (_, row) => (
        <div>
          <div className="text-sm text-gray-900">{DELIVERY_METHODS[row.delivery_method] || row.delivery_method}</div>
          {row.tracking_number && (
            <div className="text-xs text-gray-500">#{row.tracking_number}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleViewDelivery(row)} title="Ver detalle">
            <Eye className="h-4 w-4" />
          </Button>
          {row.status === 'pending' && hasPermission('deliveries.update') && (
            <Button variant="ghost" size="sm" onClick={() => setTransitTarget(row.id)} title="Marcar en tránsito">
              <Truck className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          {['pending', 'in_transit'].includes(row.status) && hasPermission('deliveries.update') && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmTarget(row.id)} title="Confirmar entrega">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {['pending', 'in_transit'].includes(row.status) && hasPermission('deliveries.delete') && (
            <Button variant="ghost" size="sm" onClick={() => setCancelTarget(row)} title="Cancelar">
              <X className="h-4 w-4 text-red-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Entregas</h1>
          <p className="text-gray-500 mt-1">Gestión de entregas a clientes</p>
        </div>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <Alert variant="error" className="mb-4" dismissible>
          Error al cargar las entregas. Intenta de nuevo.
        </Alert>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Total Entregas</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total_deliveries}</p>
              </div>
              <Package className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.pending_deliveries}</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-600 opacity-50" />
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">En Tránsito</p>
                <p className="text-2xl font-bold text-purple-900">{stats.in_transit_deliveries}</p>
              </div>
              <Truck className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Entregadas</p>
                <p className="text-2xl font-bold text-green-900">
                  {stats.deliveries_by_status?.find(s => s.status === 'delivered')?.count || 0}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card variant="flat" className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Buscar por número de entrega o tracking..."
            />
          </div>
          <div className="w-52">
            <Select value={statusFilter} onChange={handleStatusChange}>
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="in_transit">En Tránsito</option>
              <option value="delivered">Entregada</option>
              <option value="failed">Fallida</option>
              <option value="cancelled">Cancelada</option>
            </Select>
          </div>
          {hasPermission('deliveries.create') && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" /> Nueva Entrega
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={deliveries}
          loading={isLoading}
          emptyMessage="No se encontraron entregas"
        />
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setCurrentPage}
          onLimitChange={(l) => { setLimit(l); setCurrentPage(1); }}
        />
      </Card>

      {/* ── Create modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setFormData(BLANK_FORM); }}
        title="Crear Nueva Entrega"
        size="lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Número de Venta *"
                value={formData.sale_number}
                onChange={set('sale_number')}
                required
                placeholder="VEN-20240101-0001"
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Dirección de Entrega *"
                value={formData.delivery_address}
                onChange={set('delivery_address')}
                required
                rows={2}
              />
            </div>
            <Input label="Ciudad"          value={formData.delivery_city}  onChange={set('delivery_city')} />
            <Input label="Estado/Provincia" value={formData.delivery_state} onChange={set('delivery_state')} />
            <Input label="Nombre de Contacto"   value={formData.contact_name}  onChange={set('contact_name')} />
            <Input label="Teléfono de Contacto" value={formData.contact_phone} onChange={set('contact_phone')} />
            <Input
              label="Fecha Programada *"
              type="date"
              value={formData.scheduled_date}
              onChange={set('scheduled_date')}
              required
            />
            <Select
              label="Método de Entrega *"
              value={formData.delivery_method}
              onChange={set('delivery_method')}
              required
            >
              <option value="courier">Mensajería</option>
              <option value="pickup">Retiro en Tienda</option>
              <option value="own_fleet">Flota Propia</option>
              <option value="shipping_company">Transportadora</option>
            </Select>
            <Input label="Transportadora"     value={formData.carrier}          onChange={set('carrier')}          placeholder="Nombre de la transportadora" />
            <Input label="Número de Tracking" value={formData.tracking_number}  onChange={set('tracking_number')} />
            <div className="md:col-span-2">
              <Textarea label="Notas" value={formData.notes} onChange={set('notes')} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setShowCreateModal(false); setFormData(BLANK_FORM); }}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Crear Entrega
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── View modal ───────────────────────────────────────────────────────── */}
      <Modal
        open={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingDelivery(null); }}
        title="Detalle de Entrega"
        size="lg"
      >
        {viewingDelivery && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Número</p>
                <p className="font-medium">{viewingDelivery.delivery_number}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Estado</p>
                <StatusBadge status={viewingDelivery.status} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Fecha Programada</p>
                <p className="font-medium">
                  {new Date(viewingDelivery.scheduled_date).toLocaleDateString('es-VE')}
                </p>
              </div>
              {viewingDelivery.delivery_date && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Fecha de Entrega</p>
                  <p className="font-medium">
                    {new Date(viewingDelivery.delivery_date).toLocaleDateString('es-VE')}
                  </p>
                </div>
              )}
            </div>

            {/* Sale info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Información de Venta</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Número de Venta</p>
                  <p className="font-medium text-blue-600">{viewingDelivery.sale?.sale_number}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Fecha de Venta</p>
                  <p className="font-medium">
                    {new Date(viewingDelivery.sale?.sale_date).toLocaleDateString('es-VE')}
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Información de Entrega</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Cliente</p>
                  <p className="font-medium">{viewingDelivery.customer?.name}</p>
                  <p className="text-xs text-gray-500">{viewingDelivery.customer?.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Método</p>
                  <p className="font-medium">{DELIVERY_METHODS[viewingDelivery.delivery_method] || viewingDelivery.delivery_method}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Dirección</p>
                  <p className="font-medium">{viewingDelivery.delivery_address}</p>
                  {(viewingDelivery.delivery_city || viewingDelivery.delivery_state) && (
                    <p className="text-sm text-gray-500">
                      {[viewingDelivery.delivery_city, viewingDelivery.delivery_state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                {viewingDelivery.contact_name && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Contacto</p>
                    <p className="font-medium">{viewingDelivery.contact_name}</p>
                    {viewingDelivery.contact_phone && (
                      <p className="text-xs text-gray-500">{viewingDelivery.contact_phone}</p>
                    )}
                  </div>
                )}
                {viewingDelivery.carrier && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Transportadora</p>
                    <p className="font-medium">{viewingDelivery.carrier}</p>
                  </div>
                )}
                {viewingDelivery.tracking_number && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Tracking</p>
                    <p className="font-medium text-blue-600">{viewingDelivery.tracking_number}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Productos Entregados</h3>
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {viewingDelivery.details?.map((detail, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-gray-900">{detail.product?.name}</div>
                          <div className="text-xs text-gray-500">{detail.presentation?.name}</div>
                        </td>
                        <td className="px-4 py-2 text-center text-sm">
                          {detail.package_quantity_delivered}p + {detail.loose_units_delivered}u
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {viewingDelivery.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notas</p>
                <p className="text-sm text-gray-600">{viewingDelivery.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Cancel reason modal ───────────────────────────────────────────────── */}
      <Modal
        open={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        title="Cancelar Entrega"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Motivo de cancelación para <strong>{cancelTarget?.delivery_number}</strong>:
          </p>
          <Textarea
            label="Motivo *"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            placeholder="Describe el motivo de cancelación..."
          />
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="secondary" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
              Cerrar
            </Button>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason })}
              loading={cancelMutation.isPending}
              disabled={!cancelReason.trim()}
            >
              Confirmar Cancelación
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm dialogs ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!transitTarget}
        onClose={() => setTransitTarget(null)}
        onConfirm={() => transitMutation.mutate(transitTarget)}
        loading={transitMutation.isPending}
        title="¿Marcar en tránsito?"
        description="La entrega será marcada como en tránsito."
        confirmLabel="Marcar"
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmMutation.mutate(confirmTarget)}
        loading={confirmMutation.isPending}
        title="¿Confirmar entrega?"
        description="La entrega será marcada como completada con la fecha de hoy."
        confirmLabel="Confirmar"
      />
    </div>
  );
};

export default DeliveriesPage;
