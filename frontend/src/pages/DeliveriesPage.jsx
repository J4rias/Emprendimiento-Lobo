import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { deliveryService } from '../services/api/deliveryService';
import { saleService } from '../services/api/saleService';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Truck,
  CheckCircle,
  X,
  Package,
  Clock,
  XCircle,
  AlertCircle,
  MapPin
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';

const DeliveriesPage = () => {
  const { hasPermission } = useAuth();
  const searchInputRef = useRef(null);
  const wasSearchFocused = useRef(false);
  const cursorPosition = useRef(0);

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingDelivery, setViewingDelivery] = useState(null);

  const [formData, setFormData] = useState({
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
    notes: ''
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Track focus
  useEffect(() => {
    if (document.activeElement === searchInputRef.current) {
      wasSearchFocused.current = true;
      cursorPosition.current = searchInputRef.current?.selectionStart || 0;
    }
  }, [debouncedSearch]);

  // Restore focus
  useEffect(() => {
    if (!loading && wasSearchFocused.current && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.setSelectionRange(cursorPosition.current, cursorPosition.current);
      wasSearchFocused.current = false;
    }
  }, [loading]);

  useEffect(() => {
    fetchDeliveries();
    fetchStats();
  }, [currentPage, debouncedSearch, statusFilter]);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const response = await deliveryService.getAll({
        page: currentPage,
        limit: 20,
        search: debouncedSearch,
        status: statusFilter || undefined
      });
      setDeliveries(response.data);
      setTotalPages(response.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError('Error al cargar las entregas');
      console.error('Error fetching deliveries:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await deliveryService.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleCreateDelivery = async (e) => {
    e.preventDefault();

    try {
      // First, find the sale by sale_number
      const saleResponse = await saleService.getBySaleNumber(formData.sale_number);

      if (!saleResponse.data) {
        setError('Venta no encontrada');
        return;
      }

      const sale = saleResponse.data;

      const data = {
        sale_id: sale.id,
        scheduled_date: formData.scheduled_date,
        delivery_address: formData.delivery_address,
        delivery_city: formData.delivery_city || null,
        delivery_state: formData.delivery_state || null,
        contact_name: formData.contact_name || null,
        contact_phone: formData.contact_phone || null,
        delivery_method: formData.delivery_method,
        carrier: formData.carrier || null,
        tracking_number: formData.tracking_number || null,
        notes: formData.notes || null
      };

      await deliveryService.create(data);
      setShowCreateModal(false);
      fetchDeliveries();
      fetchStats();
      resetForm();
      alert('Entrega creada exitosamente');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la entrega');
    }
  };

  const handleViewDelivery = async (delivery) => {
    try {
      const response = await deliveryService.getById(delivery.id);
      setViewingDelivery(response.data);
      setShowViewModal(true);
    } catch (err) {
      alert('Error al cargar el detalle de la entrega');
    }
  };

  const handleMarkAsInTransit = async (id) => {
    if (!window.confirm('¿Marcar esta entrega como en tránsito?')) return;
    try {
      await deliveryService.markAsInTransit(id);
      fetchDeliveries();
      fetchStats();
      alert('Entrega marcada como en tránsito');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al actualizar la entrega');
    }
  };

  const handleConfirmDelivery = async (id) => {
    if (!window.confirm('¿Confirmar que esta entrega se completó exitosamente?')) return;
    try {
      await deliveryService.confirm(id, {
        delivery_date: new Date().toISOString().split('T')[0]
      });
      fetchDeliveries();
      fetchStats();
      alert('Entrega confirmada exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al confirmar la entrega');
    }
  };

  const handleCancelDelivery = async (id) => {
    const reason = prompt('Ingrese el motivo de cancelación:');
    if (!reason) return;

    try {
      await deliveryService.cancel(id, reason);
      fetchDeliveries();
      fetchStats();
      alert('Entrega cancelada exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al cancelar la entrega');
    }
  };

  const resetForm = () => {
    setFormData({
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
      notes: ''
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      in_transit: { label: 'En Tránsito', color: 'bg-blue-100 text-blue-700', icon: Truck },
      delivered: { label: 'Entregada', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      failed: { label: 'Fallida', color: 'bg-red-100 text-red-700', icon: XCircle },
      cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700', icon: X }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getDeliveryMethodLabel = (method) => {
    const methods = {
      pickup: 'Retiro en Tienda',
      courier: 'Mensajería',
      own_fleet: 'Flota Propia',
      shipping_company: 'Transportadora'
    };
    return methods[method] || method;
  };

  const columns = [
    {
      header: 'Número',
      accessor: 'delivery_number',
      render: (delivery) => (
        <div>
          <div className="font-medium text-gray-900">{delivery.delivery_number}</div>
          <div className="text-xs text-gray-500">{new Date(delivery.scheduled_date).toLocaleDateString('es-PE')}</div>
        </div>
      )
    },
    {
      header: 'Venta',
      accessor: 'sale',
      render: (delivery) => (
        <div>
          <div className="font-medium text-blue-600">{delivery.sale?.sale_number}</div>
          <div className="text-xs text-gray-500">{new Date(delivery.sale?.sale_date).toLocaleDateString('es-PE')}</div>
        </div>
      )
    },
    {
      header: 'Cliente',
      accessor: 'customer',
      render: (delivery) => (
        <div>
          <div className="font-medium text-gray-900">{delivery.customer?.name}</div>
          <div className="text-xs text-gray-500">{delivery.customer?.phone}</div>
        </div>
      )
    },
    {
      header: 'Dirección',
      accessor: 'delivery_address',
      render: (delivery) => (
        <div className="text-sm text-gray-600 max-w-xs truncate" title={delivery.delivery_address}>
          {delivery.delivery_address}
        </div>
      )
    },
    {
      header: 'Método',
      accessor: 'delivery_method',
      render: (delivery) => (
        <div>
          <div className="text-sm text-gray-900">{getDeliveryMethodLabel(delivery.delivery_method)}</div>
          {delivery.tracking_number && (
            <div className="text-xs text-gray-500">#{delivery.tracking_number}</div>
          )}
        </div>
      )
    },
    {
      header: 'Estado',
      accessor: 'status',
      render: (delivery) => getStatusBadge(delivery.status)
    },
    {
      header: 'Acciones',
      accessor: 'id',
      render: (delivery) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDelivery(delivery)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {delivery.status === 'pending' && hasPermission('deliveries.update') && (
            <button
              onClick={() => handleMarkAsInTransit(delivery.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Marcar en tránsito"
            >
              <Truck className="w-4 h-4 text-blue-600" />
            </button>
          )}
          {['pending', 'in_transit'].includes(delivery.status) && hasPermission('deliveries.update') && (
            <button
              onClick={() => handleConfirmDelivery(delivery.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Confirmar entrega"
            >
              <CheckCircle className="w-4 h-4 text-green-600" />
            </button>
          )}
          {['pending', 'in_transit'].includes(delivery.status) && hasPermission('deliveries.delete') && (
            <button
              onClick={() => handleCancelDelivery(delivery.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Cancelar"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Entregas</h1>
        <p className="text-gray-600 mt-1">Gestión de entregas a clientes</p>
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

      {/* Stats Cards */}
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
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por número de entrega o tracking..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_transit">En Tránsito</option>
            <option value="delivered">Entregada</option>
            <option value="failed">Fallida</option>
            <option value="cancelled">Cancelada</option>
          </select>

          {/* Create Button */}
          {hasPermission('deliveries.create') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nueva Entrega
            </button>
          )}
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={deliveries}
          loading={loading}
          emptyMessage="No se encontraron entregas"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Crear Nueva Entrega"
      >
        <form onSubmit={handleCreateDelivery} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de Venta *
              </label>
              <input
                type="text"
                value={formData.sale_number}
                onChange={(e) => setFormData({ ...formData, sale_number: e.target.value })}
                required
                placeholder="VEN-20240101-0001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección de Entrega *
              </label>
              <textarea
                value={formData.delivery_address}
                onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                required
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                value={formData.delivery_city}
                onChange={(e) => setFormData({ ...formData, delivery_city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado/Provincia
              </label>
              <input
                type="text"
                value={formData.delivery_state}
                onChange={(e) => setFormData({ ...formData, delivery_state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de Contacto
              </label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Programada *
              </label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Método de Entrega *
              </label>
              <select
                value={formData.delivery_method}
                onChange={(e) => setFormData({ ...formData, delivery_method: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="courier">Mensajería</option>
                <option value="pickup">Retiro en Tienda</option>
                <option value="own_fleet">Flota Propia</option>
                <option value="shipping_company">Transportadora</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transportadora
              </label>
              <input
                type="text"
                value={formData.carrier}
                onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                placeholder="Nombre de la transportadora"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de Tracking
              </label>
              <input
                type="text"
                value={formData.tracking_number}
                onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Crear Entrega
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingDelivery(null);
        }}
        title="Detalle de Entrega"
        size="large"
      >
        {viewingDelivery && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b">
              <div>
                <p className="text-sm text-gray-600">Número</p>
                <p className="font-medium">{viewingDelivery.delivery_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                {getStatusBadge(viewingDelivery.status)}
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha Programada</p>
                <p className="font-medium">{new Date(viewingDelivery.scheduled_date).toLocaleDateString('es-PE')}</p>
              </div>
              {viewingDelivery.delivery_date && (
                <div>
                  <p className="text-sm text-gray-600">Fecha de Entrega</p>
                  <p className="font-medium">{new Date(viewingDelivery.delivery_date).toLocaleDateString('es-PE')}</p>
                </div>
              )}
            </div>

            {/* Sale Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Información de Venta</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Número de Venta</p>
                  <p className="font-medium text-blue-600">{viewingDelivery.sale?.sale_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha de Venta</p>
                  <p className="font-medium">{new Date(viewingDelivery.sale?.sale_date).toLocaleDateString('es-PE')}</p>
                </div>
              </div>
            </div>

            {/* Customer & Delivery Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Información de Entrega</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="font-medium">{viewingDelivery.customer?.name}</p>
                  <p className="text-xs text-gray-500">{viewingDelivery.customer?.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Método de Entrega</p>
                  <p className="font-medium">{getDeliveryMethodLabel(viewingDelivery.delivery_method)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Dirección</p>
                  <p className="font-medium">{viewingDelivery.delivery_address}</p>
                  {(viewingDelivery.delivery_city || viewingDelivery.delivery_state) && (
                    <p className="text-sm text-gray-500">
                      {[viewingDelivery.delivery_city, viewingDelivery.delivery_state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                {viewingDelivery.contact_name && (
                  <div>
                    <p className="text-sm text-gray-600">Contacto</p>
                    <p className="font-medium">{viewingDelivery.contact_name}</p>
                    {viewingDelivery.contact_phone && (
                      <p className="text-xs text-gray-500">{viewingDelivery.contact_phone}</p>
                    )}
                  </div>
                )}
                {viewingDelivery.carrier && (
                  <div>
                    <p className="text-sm text-gray-600">Transportadora</p>
                    <p className="font-medium">{viewingDelivery.carrier}</p>
                  </div>
                )}
                {viewingDelivery.tracking_number && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">Número de Tracking</p>
                    <p className="font-medium text-blue-600">{viewingDelivery.tracking_number}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Productos Entregados</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {viewingDelivery.details?.map((detail, index) => (
                      <tr key={index}>
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

            {/* Notes */}
            {viewingDelivery.notes && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Notas</h3>
                <p className="text-sm text-gray-600">{viewingDelivery.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliveriesPage;
