import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { creditNoteService } from '../services/api/creditNoteService';
import {
  Plus,
  Search,
  Eye,
  Check,
  X,
  FileText,
  DollarSign,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';

const CreditNotesPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingCreditNote, setViewingCreditNote] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchCreditNotes();
    fetchStats();
  }, [currentPage, debouncedSearch, statusFilter]);

  const fetchCreditNotes = async () => {
    try {
      setLoading(true);
      const response = await creditNoteService.getAll({
        page: currentPage,
        limit: 20,
        search: debouncedSearch,
        status: statusFilter || undefined
      });
      setCreditNotes(response.data);
      setTotalPages(response.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError('Error al cargar las notas de crédito');
      console.error('Error fetching credit notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await creditNoteService.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleViewCreditNote = async (creditNote) => {
    try {
      const response = await creditNoteService.getById(creditNote.id);
      setViewingCreditNote(response.data);
      setShowViewModal(true);
    } catch (err) {
      alert('Error al cargar el detalle de la nota de crédito');
    }
  };

  const handleApproveCreditNote = async (id) => {
    if (!window.confirm('¿Está seguro de aprobar esta nota de crédito? Esta acción devolverá los productos al inventario.')) {
      return;
    }
    try {
      await creditNoteService.approve(id);
      fetchCreditNotes();
      fetchStats();
      alert('Nota de crédito aprobada exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al aprobar la nota de crédito');
    }
  };

  const handleCancelCreditNote = async (id) => {
    const reason = prompt('Ingrese el motivo de cancelación:');
    if (!reason) return;

    try {
      await creditNoteService.cancel(id, reason);
      fetchCreditNotes();
      fetchStats();
      alert('Nota de crédito cancelada exitosamente');
    } catch (err) {
      alert(err.response?.data?.message || 'Error al cancelar la nota de crédito');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
      approved: { label: 'Aprobada', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
      applied: { label: 'Aplicada', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700', icon: XCircle }
    };
    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getReasonLabel = (reason) => {
    const reasons = {
      return: 'Devolución',
      discount: 'Descuento',
      error: 'Error',
      other: 'Otro'
    };
    return reasons[reason] || reason;
  };

  const getRefundMethodLabel = (method) => {
    const methods = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      credit_balance: 'Saldo a Favor',
      none: 'Sin Reembolso'
    };
    return methods[method] || method;
  };

  const columns = [
    {
      header: 'Número',
      accessor: 'credit_note_number',
      render: (creditNote) => (
        <div>
          <div className="font-medium text-gray-900">{creditNote.credit_note_number}</div>
          <div className="text-xs text-gray-500">{new Date(creditNote.credit_note_date).toLocaleDateString('es-PE')}</div>
        </div>
      )
    },
    {
      header: 'Venta Original',
      accessor: 'sale',
      render: (creditNote) => (
        <div>
          <div className="font-medium text-blue-600">{creditNote.sale?.sale_number}</div>
          <div className="text-xs text-gray-500">{new Date(creditNote.sale?.sale_date).toLocaleDateString('es-PE')}</div>
        </div>
      )
    },
    {
      header: 'Cliente',
      accessor: 'customer',
      render: (creditNote) => (
        <div>
          <div className="font-medium text-gray-900">{creditNote.customer?.name}</div>
          <div className="text-xs text-gray-500">{creditNote.customer?.email}</div>
        </div>
      )
    },
    {
      header: 'Motivo',
      accessor: 'reason',
      render: (creditNote) => (
        <div>
          <div className="text-sm text-gray-900">{getReasonLabel(creditNote.reason)}</div>
          <div className="text-xs text-gray-500">{creditNote.type === 'full' ? 'Total' : 'Parcial'}</div>
        </div>
      )
    },
    {
      header: 'Total',
      accessor: 'total',
      render: (creditNote) => (
        <div className="text-right font-medium text-gray-900">
          $ {parseFloat(creditNote.total).toFixed(2)}
        </div>
      )
    },
    {
      header: 'Estado',
      accessor: 'status',
      render: (creditNote) => getStatusBadge(creditNote.status)
    },
    {
      header: 'Acciones',
      accessor: 'id',
      render: (creditNote) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewCreditNote(creditNote)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {creditNote.status === 'draft' && hasPermission('credit_notes.approve') && (
            <button
              onClick={() => handleApproveCreditNote(creditNote.id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Aprobar"
            >
              <Check className="w-4 h-4 text-green-600" />
            </button>
          )}
          {creditNote.status === 'draft' && hasPermission('credit_notes.delete') && (
            <button
              onClick={() => handleCancelCreditNote(creditNote.id)}
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
        <h1 className="text-2xl font-bold text-gray-800">Notas de Crédito</h1>
        <p className="text-gray-600 mt-1">Gestión de devoluciones y notas de crédito</p>
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
                <p className="text-sm text-blue-700">Total Notas</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total_credit_notes}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Aplicadas</p>
                <p className="text-2xl font-bold text-green-900">
                  {stats.credit_notes_by_status?.find(s => s.status === 'applied')?.count || 0}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Total Reembolsado</p>
                <p className="text-2xl font-bold text-orange-900">
                  $ {parseFloat(stats.total_refunded || 0).toFixed(2)}
                </p>
              </div>
              <TrendingDown className="w-10 h-10 text-orange-600 opacity-50" />
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
                type="text"
                placeholder="Buscar por número de nota de crédito..."
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
            <option value="draft">Borrador</option>
            <option value="approved">Aprobada</option>
            <option value="applied">Aplicada</option>
            <option value="cancelled">Cancelada</option>
          </select>

          {/* Create Button */}
          {hasPermission('credit_notes.create') && (
            <button
              onClick={() => navigate('/credit-notes/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Nueva Nota de Crédito
            </button>
          )}
        </div>
      </div>

      {/* Credit Notes Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={creditNotes}
          loading={loading}
          emptyMessage="No se encontraron notas de crédito"
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingCreditNote(null);
        }}
        title="Detalle de Nota de Crédito"
        size="large"
      >
        {viewingCreditNote && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b">
              <div>
                <p className="text-sm text-gray-600">Número</p>
                <p className="font-medium">{viewingCreditNote.credit_note_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha</p>
                <p className="font-medium">{new Date(viewingCreditNote.credit_note_date).toLocaleDateString('es-PE')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                {getStatusBadge(viewingCreditNote.status)}
              </div>
              <div>
                <p className="text-sm text-gray-600">Tipo</p>
                <p className="font-medium">{viewingCreditNote.type === 'full' ? 'Total' : 'Parcial'}</p>
              </div>
            </div>

            {/* Sale Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Venta Original</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Número de Venta</p>
                  <p className="font-medium text-blue-600">{viewingCreditNote.sale?.sale_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha de Venta</p>
                  <p className="font-medium">{new Date(viewingCreditNote.sale?.sale_date).toLocaleDateString('es-PE')}</p>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Cliente</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Nombre</p>
                  <p className="font-medium">{viewingCreditNote.customer?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{viewingCreditNote.customer?.email}</p>
                </div>
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Productos Devueltos</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Devuelto</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Precio Unit.</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {viewingCreditNote.details?.map((detail, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-gray-900">{detail.product?.name}</div>
                          <div className="text-xs text-gray-500">{detail.presentation?.name}</div>
                        </td>
                        <td className="px-4 py-2 text-center text-sm">
                          {detail.package_quantity_returned}p + {detail.loose_units_returned}u
                        </td>
                        <td className="px-4 py-2 text-right text-sm">
                          $ {parseFloat(detail.unit_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-medium">
                          $ {parseFloat(detail.line_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="border-t pt-4">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="text-sm font-medium">$ {parseFloat(viewingCreditNote.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Impuestos:</span>
                    <span className="text-sm font-medium">$ {parseFloat(viewingCreditNote.tax_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total:</span>
                    <span className="font-semibold text-lg">$ {parseFloat(viewingCreditNote.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Refund Info */}
            {viewingCreditNote.refund_method !== 'none' && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Información de Reembolso</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Método de Reembolso</p>
                    <p className="font-medium">{getRefundMethodLabel(viewingCreditNote.refund_method)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monto Reembolsado</p>
                    <p className="font-medium">$ {parseFloat(viewingCreditNote.refund_amount).toFixed(2)}</p>
                  </div>
                  {viewingCreditNote.refund_reference && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Referencia</p>
                      <p className="font-medium">{viewingCreditNote.refund_reference}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {viewingCreditNote.notes && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Notas</h3>
                <p className="text-sm text-gray-600">{viewingCreditNote.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CreditNotesPage;
