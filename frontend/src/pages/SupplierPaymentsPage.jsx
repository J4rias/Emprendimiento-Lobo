import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supplierPaymentService } from '../services/api/supplierPaymentService';
import { supplierService } from '../services/api/supplierService';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  X,
  DollarSign,
  TrendingUp,
  CreditCard,
  Calendar,
  AlertCircle,
  FileText
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';

const SupplierPaymentsPage = () => {
  const { hasPermission } = useAuth();
  const searchInputRef = useRef(null);
  const wasSearchFocused = useRef(false);
  const cursorPosition = useRef(0);

  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  const [formData, setFormData] = useState({
    supplier_id: '',
    purchase_order_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'transfer',
    amount: '',
    currency: 'USD',
    reference: '',
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
    fetchPayments();
    fetchStats();
    fetchSuppliers();
  }, [currentPage, debouncedSearch, supplierFilter, paymentMethodFilter]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await supplierPaymentService.getAll({
        page: currentPage,
        limit: 20,
        search: debouncedSearch,
        supplier_id: supplierFilter || undefined,
        payment_method: paymentMethodFilter || undefined
      });
      setPayments(response.data);
      setTotalPages(response.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError('Error al cargar los pagos');
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await supplierPaymentService.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await supplierService.getActive();
      setSuppliers(response.data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchPurchaseOrdersBySupplier = async (supplierId) => {
    if (!supplierId) {
      setPurchaseOrders([]);
      return;
    }
    try {
      const response = await purchaseOrderService.getAll({
        supplier_id: supplierId,
        status: 'received', // Only show received orders
        limit: 100
      });
      setPurchaseOrders(response.data || []);
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
      setPurchaseOrders([]);
    }
  };

  const handleSupplierChange = (supplierId) => {
    setFormData(prev => ({ ...prev, supplier_id: supplierId, purchase_order_id: '' }));
    fetchPurchaseOrdersBySupplier(supplierId);
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    try {
      await supplierPaymentService.create(formData);
      setShowCreateModal(false);
      fetchPayments();
      fetchStats();
      resetForm();
      alert('Pago registrado exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al registrar el pago');
    }
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    try {
      await supplierPaymentService.update(editingPayment.id, formData);
      setShowEditModal(false);
      fetchPayments();
      fetchStats();
      resetForm();
      alert('Pago actualizado exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al actualizar el pago');
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este pago?')) return;
    try {
      await supplierPaymentService.delete(id);
      fetchPayments();
      fetchStats();
      alert('Pago eliminado exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar el pago');
    }
  };

  const handleViewPayment = async (payment) => {
    setViewingPayment(payment);
    setShowViewModal(true);
  };

  const handleEditPayment = async (payment) => {
    setEditingPayment(payment);
    setFormData({
      supplier_id: payment.supplier_id,
      purchase_order_id: payment.purchase_order_id || '',
      payment_date: payment.payment_date,
      payment_method: payment.payment_method,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference || '',
      notes: payment.notes || ''
    });
    await fetchPurchaseOrdersBySupplier(payment.supplier_id);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      purchase_order_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'transfer',
      amount: '',
      currency: 'USD',
      reference: '',
      notes: ''
    });
    setPurchaseOrders([]);
    setEditingPayment(null);
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      check: 'Cheque',
      card: 'Tarjeta',
      other: 'Otro'
    };
    return methods[method] || method;
  };

  const getPaymentMethodBadge = (method) => {
    const config = {
      cash: 'bg-green-100 text-green-700',
      transfer: 'bg-blue-100 text-blue-700',
      check: 'bg-purple-100 text-purple-700',
      card: 'bg-yellow-100 text-yellow-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config[method] || config.other}`}>
        {getPaymentMethodLabel(method)}
      </span>
    );
  };

  const columns = [
    {
      header: 'Número',
      accessor: 'payment_number',
      render: (payment) => (
        <div>
          <div className="font-medium text-gray-900">{payment.payment_number}</div>
          <div className="text-xs text-gray-500">{new Date(payment.payment_date).toLocaleDateString('es-PE')}</div>
        </div>
      )
    },
    {
      header: 'Proveedor',
      accessor: 'supplier',
      render: (payment) => (
        <div>
          <div className="font-medium text-gray-900">{payment.supplier?.name}</div>
          <div className="text-xs text-gray-500">{payment.supplier?.company_name}</div>
        </div>
      )
    },
    {
      header: 'Orden de Compra',
      accessor: 'purchaseOrder',
      render: (payment) => payment.purchaseOrder ? (
        <div className="text-sm text-blue-600">{payment.purchaseOrder.order_number}</div>
      ) : (
        <span className="text-xs text-gray-400">N/A</span>
      )
    },
    {
      header: 'Método',
      accessor: 'payment_method',
      render: (payment) => getPaymentMethodBadge(payment.payment_method)
    },
    {
      header: 'Monto',
      accessor: 'amount',
      render: (payment) => (
        <div className="text-right">
          <div className="font-medium text-gray-900">{payment.currency} {parseFloat(payment.amount).toFixed(2)}</div>
          {payment.reference && <div className="text-xs text-gray-500">Ref: {payment.reference}</div>}
        </div>
      )
    },
    {
      header: 'Registrado por',
      accessor: 'creator',
      render: (payment) => (
        <div className="text-sm text-gray-600">{payment.creator?.full_name || payment.creator?.username}</div>
      )
    },
    {
      header: 'Acciones',
      accessor: 'id',
      render: (payment) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewPayment(payment)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {hasPermission('payments.update') && (
            <button
              onClick={() => handleEditPayment(payment)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Editar"
            >
              <Edit className="w-4 h-4 text-yellow-600" />
            </button>
          )}
          {hasPermission('payments.delete') && (
            <button
              onClick={() => handleDeletePayment(payment.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
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
        <h1 className="text-2xl font-bold text-gray-800">Pagos a Proveedores</h1>
        <p className="text-gray-600 mt-1">Gestión de pagos realizados a proveedores</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Total Pagos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total_payments}</p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Total en USD</p>
                <p className="text-2xl font-bold text-green-900">
                  ${stats.total_by_currency?.find(c => c.currency === 'USD')?.total_amount || '0.00'}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Métodos Usados</p>
                <p className="text-2xl font-bold text-purple-900">{stats.payments_by_method?.length || 0}</p>
              </div>
              <CreditCard className="w-10 h-10 text-purple-600 opacity-50" />
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
                placeholder="Buscar por número de pago o referencia..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Supplier Filter */}
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los métodos</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="check">Cheque</option>
            <option value="card">Tarjeta</option>
            <option value="other">Otro</option>
          </select>

          {/* Create Button */}
          {hasPermission('payments.create') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nuevo Pago
            </button>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          emptyMessage="No se encontraron pagos"
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
        title="Registrar Nuevo Pago"
      >
        <form onSubmit={handleCreatePayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor *
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => handleSupplierChange(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccione un proveedor</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} - {supplier.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Orden de Compra (Opcional)
              </label>
              <select
                value={formData.purchase_order_id}
                onChange={(e) => setFormData({ ...formData, purchase_order_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!formData.supplier_id}
              >
                <option value="">Sin orden asociada</option>
                {purchaseOrders.map(order => (
                  <option key={order.id} value={order.id}>
                    {order.order_number} - {order.currency} {parseFloat(order.total).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Método de Pago *
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="check">Cheque</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="USD">USD</option>
                <option value="COP">COP</option>
                <option value="VES">VES</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referencia
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Número de cheque, referencia de transferencia, etc."
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
                rows={3}
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
              Registrar Pago
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="Editar Pago"
      >
        <form onSubmit={handleUpdatePayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Método de Pago *
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="check">Cheque</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="USD">USD</option>
                <option value="COP">COP</option>
                <option value="VES">VES</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referencia
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Número de cheque, referencia de transferencia, etc."
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
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
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
              Actualizar Pago
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingPayment(null);
        }}
        title="Detalle del Pago"
      >
        {viewingPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Número de Pago</p>
                <p className="font-medium">{viewingPayment.payment_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha</p>
                <p className="font-medium">{new Date(viewingPayment.payment_date).toLocaleDateString('es-PE')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Proveedor</p>
                <p className="font-medium">{viewingPayment.supplier?.name}</p>
                <p className="text-xs text-gray-500">{viewingPayment.supplier?.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Orden de Compra</p>
                <p className="font-medium">{viewingPayment.purchaseOrder?.order_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Método de Pago</p>
                <p className="font-medium">{getPaymentMethodLabel(viewingPayment.payment_method)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monto</p>
                <p className="font-medium text-lg">{viewingPayment.currency} {parseFloat(viewingPayment.amount).toFixed(2)}</p>
              </div>
              {viewingPayment.reference && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Referencia</p>
                  <p className="font-medium">{viewingPayment.reference}</p>
                </div>
              )}
              {viewingPayment.notes && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Notas</p>
                  <p className="font-medium">{viewingPayment.notes}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Registrado por</p>
                <p className="font-medium">{viewingPayment.creator?.full_name || viewingPayment.creator?.username}</p>
                <p className="text-xs text-gray-500">{new Date(viewingPayment.created_at).toLocaleString('es-PE')}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SupplierPaymentsPage;
