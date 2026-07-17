import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  MagnifyingGlass,
  Funnel,
  WarningCircle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowClockwise,
  DotsThreeVertical,
  CaretDown
} from '@phosphor-icons/react';
import { creditNoteService } from '../services/api/creditNoteService';
import { ViewAction, Pagination, useTableLimit } from '../components/ui';
import { formatByCurrency } from '../utils/formatUtils';

interface CreditNote {
  id: number;
  credit_note_number: string;
  credit_note_date: string;
  customer?: {
    businessName?: string;
    firstName?: string;
    lastName?: string;
    documentType?: string;
    documentNumber?: string;
  };
  sale?: {
    sale_number: string;
    currency?: string;
  };
  type: string;
  refund_method: string;
  total: number;
  status: string;
}

interface CreditNotesResponse {
  data?: CreditNote[];
  pagination?: { total: number; totalPages: number };
}

interface CreditNoteStats {
  totalCount?: number;
  totalsByCurrency?: Record<string, number | string>;
  pendingCount?: number;
  cancelledCount?: number;
}

interface StatsResponse {
  data?: CreditNoteStats;
}

const CreditNotesPage = () => {
  const [limit, setLimit] = useTableLimit();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    type: '',
    page: 1,
  });

  const { data: notesData, isLoading: loading, refetch } = useQuery({
    queryKey: ['credit-notes', filters, limit],
    queryFn: () => creditNoteService.getAll({ ...filters, limit }),
    placeholderData: (prev: unknown) => prev,
    staleTime: 30_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['credit-notes-stats'],
    queryFn: () => creditNoteService.getStats(),
    staleTime: 60_000,
  });

  const notesResult = notesData as CreditNotesResponse | undefined;
  const creditNotes = notesResult?.data || [];
  const pagination = notesResult?.pagination || { total: 0, totalPages: 0 };
  const stats = (statsData as StatsResponse | undefined)?.data || null;

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800"><Clock className="w-4 h-4 mr-1" /> Borrador</span>;
      case 'approved':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800"><CheckCircle className="w-4 h-4 mr-1" /> Aprobado</span>;
      case 'applied':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"><CheckCircle className="w-4 h-4 mr-1" /> Aplicado</span>;
      case 'cancelled':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800"><XCircle className="w-4 h-4 mr-1" /> Anulado</span>;
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'COP'
    }).format(Number(amount));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notas de Crédito y Devoluciones</h1>
          <p className="text-gray-600 mt-1">Gestiona las devoluciones de mercancía y los saldos a favor</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-500 truncate">Total Emitidas (Mes)</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{stats.totalCount || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-500 truncate">Monto Total Devuelto</div>
            <div className="mt-1 text-2xl font-bold text-red-600 text-base break-words">
              {stats.totalsByCurrency ? Object.entries(stats.totalsByCurrency).map(([curr, amount]) => (
                <div key={curr}>{formatByCurrency(amount, curr)}</div>
              )) : '$ 0.00'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-500 truncate">Saldos por Aplicar</div>
            <div className="mt-1 text-2xl font-bold text-yellow-600">{stats.pendingCount || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-500 truncate">Notas Anuladas</div>
            <div className="mt-1 text-2xl font-bold text-gray-400">{stats.cancelledCount || 0}</div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white rounded-lg shadow">
        {/* Filters Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex-1 flex gap-4">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar documento, cliente..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-200"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Funnel className="w-5 h-5 text-gray-400" />
                <select
                  className="border border-gray-300 rounded-md py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                >
                  <option value="">Todos los Estados</option>
                  <option value="draft">Borrador</option>
                  <option value="approved">Aprobada</option>
                  <option value="applied">Aplicada</option>
                  <option value="cancelled">Anulada</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => refetch()}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Actualizar"
            >
              <ArrowClockwise className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venta Origen</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo/Método</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <ArrowClockwise className="w-8 h-8 mx-auto animate-spin mb-4" />
                    <p>Cargando notas de crédito...</p>
                  </td>
                </tr>
              ) : creditNotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron notas de crédito con los filtros actuales
                  </td>
                </tr>
              ) : (
                creditNotes.map((note: CreditNote) => (
                  <tr key={note.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-primary-600">{note.credit_note_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(note.credit_note_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{note.customer?.businessName || `${note.customer?.firstName || ''} ${note.customer?.lastName || ''}`.trim() || 'Cliente General'}</div>
                      <div className="text-sm text-gray-500">{note.customer?.documentType}-{note.customer?.documentNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {note.sale?.sale_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">{note.type === 'full' ? 'Total' : 'Parcial'}</div>
                      <div className="text-xs text-gray-500">
                        {note.refund_method === 'credit_balance' ? 'Abonado a Monedero' : note.refund_method}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      {/* Ideally currency should come from the Sale original, assume DB handles it or it's mapped */}
                      <span className="text-red-600">
                        {formatByCurrency(note.total, note.sale?.currency || 'USD')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(note.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <ViewAction title="Ver Detalles" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pagination.totalPages > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <Pagination
              page={filters.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={limit}
              onPageChange={handlePageChange}
              onLimitChange={(newLimit: number) => { setLimit(newLimit); setFilters(prev => ({ ...prev, page: 1 })); }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditNotesPage;
