import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, FileText } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

const QuotesPage = () => {
  const { token, hasPermission } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const statusLabels = {
    draft: { text: 'Borrador', class: 'bg-gray-100 text-gray-800' },
    sent: { text: 'Enviada', class: 'bg-blue-100 text-blue-800' },
    approved: { text: 'Aprobada', class: 'bg-green-100 text-green-800' },
    rejected: { text: 'Rechazada', class: 'bg-red-100 text-red-800' },
    converted: { text: 'Convertida', class: 'bg-purple-100 text-purple-800' },
    expired: { text: 'Vencida', class: 'bg-orange-100 text-orange-800' },
  };

  useEffect(() => {
    fetchQuotes();
  }, [currentPage, search, statusFilter]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`${API_URL}/quotes?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setQuotes(data.data.quotes);
        setTotalPages(data.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta cotización?')) return;

    try {
      const response = await fetch(`${API_URL}/quotes/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        fetchQuotes();
      } else {
        alert(data.message || 'Error al eliminar la cotización');
      }
    } catch (error) {
      console.error('Error deleting quote:', error);
      alert('Error al eliminar la cotización');
    }
  };

  const handleView = (quote) => {
    setSelectedQuote(quote);
    setShowModal(true);
  };

  const columns = [
    { header: 'Código', accessor: 'code' },
    {
      header: 'Cliente',
      accessor: (row) => row.customer?.businessName || `${row.customer?.firstName} ${row.customer?.lastName}`,
    },
    {
      header: 'Fecha',
      accessor: (row) => new Date(row.quoteDate || row.created_at).toLocaleDateString('es-PE'),
    },
    {
      header: 'Estado',
      accessor: (row) => {
        const status = statusLabels[row.status] || statusLabels.draft;
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.class}`}>
            {status.text}
          </span>
        );
      },
    },
    {
      header: 'Total',
      accessor: (row) => `$ ${parseFloat(row.total || 0).toFixed(2)}`,
      className: 'text-right font-semibold',
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleView(row)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Ver detalles"
          >
            <Eye className="h-4 w-4" />
          </button>
          {hasPermission('sales.quotes.update') && row.status === 'draft' && (
            <button
              onClick={() => {/* TODO: Navigate to edit */}}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          {hasPermission('sales.quotes.delete') && row.status === 'draft' && (
            <button
              onClick={() => handleDelete(row.id)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-gray-600 mt-1">Gestiona las cotizaciones de venta</p>
        </div>
        {hasPermission('sales.quotes.create') && (
          <button
            onClick={() => {/* TODO: Navigate to create */}}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nueva Cotización
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por código, cliente..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="input"
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="sent">Enviada</option>
            <option value="approved">Aprobada</option>
            <option value="rejected">Rechazada</option>
            <option value="converted">Convertida</option>
            <option value="expired">Vencida</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={quotes}
          loading={loading}
          emptyMessage="No se encontraron cotizaciones"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      {showModal && selectedQuote && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedQuote(null);
          }}
          title={`Cotización ${selectedQuote.code}`}
          size="large"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Cliente</label>
                <p className="mt-1 text-gray-900">
                  {selectedQuote.customer?.businessName ||
                   `${selectedQuote.customer?.firstName} ${selectedQuote.customer?.lastName}`}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Fecha</label>
                <p className="mt-1 text-gray-900">
                  {new Date(selectedQuote.quoteDate || selectedQuote.created_at).toLocaleDateString('es-PE')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Estado</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusLabels[selectedQuote.status].class}`}>
                    {statusLabels[selectedQuote.status].text}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Vendedor</label>
                <p className="mt-1 text-gray-900">
                  {selectedQuote.user?.first_name} {selectedQuote.user?.last_name}
                </p>
              </div>
            </div>

            {selectedQuote.notes && (
              <div>
                <label className="text-sm font-medium text-gray-700">Notas</label>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{selectedQuote.notes}</p>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>$ {parseFloat(selectedQuote.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default QuotesPage;
