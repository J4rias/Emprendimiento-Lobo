import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { useAuth } from '../context/AuthContext';
import { deliveryService } from '../services/api/deliveryService';
import { saleService } from '../services/api/saleService';
import { toast } from 'sonner';
import {
  Plus, Package, Clock, Truck, CheckCircle,
} from '@phosphor-icons/react';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Input, Modal,
  Pagination, SearchInput, Select, Table, Textarea, useTableLimit,
  ViewAction, TransitAction, DeliverAction, CancelAction,
} from '../components/ui';
import type { BadgeVariant, Column } from '../components/ui';
import DeliveryViewSheet from '../components/deliveries/DeliveryViewSheet';
import { localToday } from '../utils/dateUtils';
import { formatDateShort } from '../utils/formatUtils';

// ── Local Interfaces ──────────────────────────────────────────────────────────
interface Delivery {
  id: number;
  delivery_number: string;
  scheduled_date: string;
  delivery_address: string;
  delivery_city?: string;
  delivery_state?: string;
  contact_name?: string;
  contact_phone?: string;
  delivery_method: string;
  carrier?: string;
  tracking_number?: string;
  notes?: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  sale?: { sale_number: string; sale_date: string };
  customer?: { name: string; phone: string };
}

interface DeliveryStats {
  total_deliveries: number;
  pending_deliveries: number;
  in_transit_deliveries: number;
  deliveries_by_status?: { status: string; count: number }[];
}

interface DeliveryForm {
  sale_number: string;
  scheduled_date: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  contact_name: string;
  contact_phone: string;
  delivery_method: string;
  carrier: string;
  tracking_number: string;
  notes: string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_VARIANT: Record<Delivery['status'], BadgeVariant> = {
  pending: 'warning', in_transit: 'info', delivered: 'success',
  failed: 'error',    cancelled: 'neutral',
};
const STATUS_LABEL: Record<Delivery['status'], string> = {
  pending: 'Pendiente', in_transit: 'En Tránsito', delivered: 'Entregada',
  failed: 'Fallida',    cancelled: 'Cancelada',
};
const DELIVERY_METHODS: Record<string, string> = {
  pickup: 'Retiro en Tienda', courier: 'Mensajería',
  own_fleet: 'Flota Propia',  shipping_company: 'Transportadora',
};

const BLANK_FORM: DeliveryForm = {
  sale_number: '',
  scheduled_date: localToday(),
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

const StatusBadge = ({ status }: { status: Delivery['status'] }) => (
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
  const [viewingDelivery, setViewingDelivery] = useState<Delivery | null>(null);
  const [formData, setFormData]               = useState<DeliveryForm>(BLANK_FORM);

  // State for action confirmations
  const [transitTarget, setTransitTarget] = useState<number | null>(null); // id
  const [confirmTarget, setConfirmTarget] = useState<number | null>(null); // id
  const [cancelTarget, setCancelTarget]   = useState<Delivery | null>(null); // delivery object
  const [cancelReason, setCancelReason]   = useState('');

  // ─── Sort (server-side) ───────────────────────────────────────────────────────
  const { sortBy: delSortBy, sortDir: delSortDir, onSort: _delOnSort } = useTableSort([], { serverSide: true, defaultField: 'scheduled_date', defaultDir: 'desc' });
  const delOnSort = (f: string, d: 'asc' | 'desc') => { _delOnSort(f, d); setCurrentPage(1); };

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: deliveriesData, isLoading, isError: fetchError } = useQuery({
    queryKey: ['deliveries', currentPage, search, statusFilter, limit, delSortBy, delSortDir],
    queryFn: () => deliveryService.getAll({
      page: currentPage, limit,
      search: search || undefined,
      status: statusFilter || undefined,
      sort_by: delSortBy,
      sort_dir: delSortDir,
    }),
    staleTime: 30_000,
  });
  const deliveries = deliveriesData?.data || [];
  const totalPages = deliveriesData?.pagination?.totalPages || 1;
  const total      = deliveriesData?.pagination?.total || 0;

  const { data: statsData } = useQuery({
    queryKey: ['deliveries-stats'],
    queryFn:  () => deliveryService.getStats(),
    staleTime: 60_000,
  });
  const stats: DeliveryStats | null = statsData?.data || null;

  // ─── Invalidate helper ────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['deliveries-stats'] });
  };

  // ─── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: DeliveryForm) => {
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
    onError: (err: unknown) => {
      const error = err as any;
      toast.error(error?.response?.data?.message || error?.message || 'Error al crear la entrega');
    },
  });

  const transitMutation = useMutation({
    mutationFn: (id: number) => deliveryService.markAsInTransit(id),
    onSuccess: () => {
      toast.success('Entrega marcada como en tránsito');
      setTransitTarget(null);
      invalidate();
    },
    onError: (err: unknown) => {
      const error = err as any;
      toast.error(error?.response?.data?.message || 'Error al actualizar la entrega');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: number) => deliveryService.confirm(id, {
      delivery_date: localToday(),
    }),
    onSuccess: () => {
      toast.success('Entrega confirmada exitosamente');
      setConfirmTarget(null);
      invalidate();
    },
    onError: (err: unknown) => {
      const error = err as any;
      toast.error(error?.response?.data?.message || 'Error al confirmar la entrega');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (params: { id: number; reason: string }) => deliveryService.cancel(params.id, params.reason),
    onSuccess: () => {
      toast.success('Entrega cancelada exitosamente');
      setCancelTarget(null);
      setCancelReason('');
      invalidate();
    },
    onError: (err: unknown) => {
      const error = err as any;
      toast.error(error?.response?.data?.message || 'Error al cancelar la entrega');
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const set = (f: keyof DeliveryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
    setFormData(p => ({ ...p, [f]: e.target.value }));

  const handleSearchChange  = (v: string) => { setSearch(v);            setCurrentPage(1); };
  const handleStatusChange  = (e: React.ChangeEvent<HTMLSelectElement>) => { setStatusFilter(e.target.value); setCurrentPage(1); };

  const handleViewDelivery = async (delivery: Delivery) => {
    try {
      const response = await deliveryService.getById(delivery.id);
      setViewingDelivery(response.data);
      setShowViewModal(true);
    } catch {
      toast.error('Error al cargar el detalle de la entrega');
    }
  };

  // ─── Table columns ────────────────────────────────────────────────────────────
  const columns: Column<Delivery>[] = [
    {
      key: 'delivery_number',
      header: 'Número',
      sortable: true,
      sortKey: 'delivery_number',
      render: (_: unknown, row: Delivery) => (
        <div>
          <div className="font-medium text-gray-900">{row.delivery_number}</div>
          <div className="text-xs text-gray-500">
            {formatDateShort(row.scheduled_date)}
          </div>
        </div>
      ),
    },
    {
      key: 'sale',
      header: 'Venta',
      render: (_: unknown, row: Delivery) => (
        <div>
          <div className="font-medium text-primary-600">{row.sale?.sale_number}</div>
          <div className="text-xs text-gray-500">
            {formatDateShort(row.sale?.sale_date)}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_: unknown, row: Delivery) => (
        <div>
          <div className="font-medium text-gray-900">{row.customer?.name}</div>
          <div className="text-xs text-gray-500">{row.customer?.phone}</div>
        </div>
      ),
    },
    {
      key: 'delivery_address',
      header: 'Dirección',
      render: (v: unknown) => (
        <div className="text-sm text-gray-600 max-w-xs truncate" title={String(v || '')}>{String(v || '')}</div>
      ),
    },
    {
      key: 'delivery_method',
      header: 'Método',
      render: (_: unknown, row: Delivery) => (
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
      sortable: true,
      sortKey: 'status',
      render: (v: unknown) => <StatusBadge status={v as Delivery['status']} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_: unknown, row: Delivery) => (
        <div className="flex gap-1">
          <ViewAction onClick={() => handleViewDelivery(row)} />
          {row.status === 'pending' && hasPermission('deliveries.update') && (
            <TransitAction onClick={() => setTransitTarget(row.id)} />
          )}
          {['pending', 'in_transit'].includes(row.status) && hasPermission('deliveries.update') && (
            <DeliverAction onClick={() => setConfirmTarget(row.id)} />
          )}
          {['pending', 'in_transit'].includes(row.status) && hasPermission('deliveries.delete') && (
            <CancelAction onClick={() => setCancelTarget(row)} />
          )}
        </div>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-primary-50 rounded-lg p-4 border border-primary-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-700">Total Entregas</p>
                <p className="text-2xl font-bold text-primary-900">{stats.total_deliveries}</p>
              </div>
              <Package className="w-10 h-10 text-primary-600 opacity-50" />
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
                  {stats.deliveries_by_status?.find((s: { status: string; count: number }) => s.status === 'delivered')?.count || 0}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card variant="flat" >
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
          sortBy={delSortBy}
          sortDir={delSortDir}
          onSort={delOnSort}
        />
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setCurrentPage}
          onLimitChange={(l: number) => { setLimit(l); setCurrentPage(1); }}
        />
      </Card>

      {/* ── Create modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setFormData(BLANK_FORM); }}
        title="Crear Nueva Entrega"
        size="lg"
      >
        <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
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

      {/* ── View sheet ───────────────────────────────────────────────────────── */}
      <DeliveryViewSheet
        open={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingDelivery(null); }}
        delivery={viewingDelivery}
      />

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
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCancelReason(e.target.value)}
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
              onClick={() => cancelMutation.mutate({ id: cancelTarget!.id, reason: cancelReason })}
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
        onConfirm={() => transitMutation.mutate(transitTarget!)}
        loading={transitMutation.isPending}
        title="¿Marcar en tránsito?"
        description="La entrega será marcada como en tránsito."
        confirmLabel="Marcar"
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmMutation.mutate(confirmTarget!)}
        loading={confirmMutation.isPending}
        title="¿Confirmar entrega?"
        description="La entrega será marcada como completada con la fecha de hoy."
        confirmLabel="Confirmar"
      />
    </div>
  );
};

export default DeliveriesPage;
