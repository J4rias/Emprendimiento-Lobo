import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { quoteService } from '../services/api/quoteService';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Modal, Pagination, SearchInput, Select, Table, useTableLimit,
} from '../components/ui';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_VARIANT = {
  draft: 'neutral', sent: 'info', approved: 'success',
  rejected: 'error', converted: 'purple', expired: 'warning',
};
const STATUS_LABEL = {
  draft: 'Borrador', sent: 'Enviada', approved: 'Aprobada',
  rejected: 'Rechazada', converted: 'Convertida', expired: 'Vencida',
};

const customerName = (c) =>
  c?.businessName || `${c?.firstName || ''} ${c?.lastName || ''}`.trim();

const QuotesPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useTableLimit();

  // ─── Filtros y paginación ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ─── Query ───────────────────────────────────────────────────────────────────
  const {
    data: quotesData,
    isLoading,
    isError: fetchError,
  } = useQuery({
    queryKey: ['quotes', currentPage, search, statusFilter, limit],
    queryFn: () => quoteService.getAll({
      page: currentPage,
      limit,
      ...(search       && { search }),
      ...(statusFilter && { status: statusFilter }),
    }),
    staleTime: 30_000,
  });

  const quotes     = quotesData?.data?.quotes || [];
  const totalPages = quotesData?.data?.pagination?.pages || 1;
  const total      = quotesData?.data?.pagination?.total || 0;

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => quoteService.delete(id),
    onSuccess: () => {
      toast.success('Cotización eliminada');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al eliminar la cotización');
      setDeleteTarget(null);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSearchChange  = (value) => { setSearch(value); setCurrentPage(1); };
  const handleStatusFilter  = (e)     => { setStatusFilter(e.target.value); setCurrentPage(1); };

  // ─── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    { key: 'code',   header: 'Código',  render: (v) => v },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_, row) => customerName(row.customer),
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (_, row) =>
        new Date(row.quoteDate || row.created_at).toLocaleDateString('es-VE'),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (_, row) => (
        <Badge variant={STATUS_VARIANT[row.status] || 'neutral'}>
          {STATUS_LABEL[row.status] || row.status}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (_, row) => `$ ${parseFloat(row.total || 0).toFixed(2)}`,
      cellClassName: 'text-right font-semibold',
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSelectedQuote(row)} title="Ver detalles">
            <Eye className="h-4 w-4" />
          </Button>
          {hasPermission('sales.quotes.update') && row.status === 'draft' && (
            <Button variant="ghost" size="sm" onClick={() => {}} title="Editar">
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {hasPermission('sales.quotes.delete') && row.status === 'draft' && (
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row)} title="Eliminar">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* ── Cabecera ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cotizaciones</h1>
          <p className="text-gray-500 mt-1">Gestiona las cotizaciones de venta</p>
        </div>
        {hasPermission('sales.quotes.create') && (
          <Button onClick={() => {}}>
            <Plus className="h-4 w-4" /> Nueva Cotización
          </Button>
        )}
      </div>

      {/* ── Error de carga ────────────────────────────────────────────────────── */}
      {fetchError && (
        <Alert variant="error" className="mb-4" dismissible>
          Error al cargar las cotizaciones. Intenta de nuevo.
        </Alert>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Buscar por código, cliente..."
            />
          </div>
          <div className="w-52">
            <Select value={statusFilter} onChange={handleStatusFilter}>
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="approved">Aprobada</option>
              <option value="rejected">Rechazada</option>
              <option value="converted">Convertida</option>
              <option value="expired">Vencida</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── Tabla ─────────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={quotes}
          loading={isLoading}
          emptyMessage="No se encontraron cotizaciones"
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

      {/* ── Modal ver cotización ──────────────────────────────────────────────── */}
      <Modal
        open={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        title={selectedQuote ? `Cotización ${selectedQuote.code}` : ''}
        size="lg"
      >
        {selectedQuote && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Cliente</p>
                <p className="text-gray-900">{customerName(selectedQuote.customer)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Fecha</p>
                <p className="text-gray-900">
                  {new Date(selectedQuote.quoteDate || selectedQuote.created_at).toLocaleDateString('es-VE')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Estado</p>
                <Badge variant={STATUS_VARIANT[selectedQuote.status] || 'neutral'}>
                  {STATUS_LABEL[selectedQuote.status] || selectedQuote.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Vendedor</p>
                <p className="text-gray-900">
                  {selectedQuote.user?.first_name} {selectedQuote.user?.last_name}
                </p>
              </div>
            </div>

            {selectedQuote.notes && (
              <div className="text-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Notas</p>
                <p className="text-gray-900 whitespace-pre-wrap">{selectedQuote.notes}</p>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4 flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>$ {parseFloat(selectedQuote.total || 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirmar eliminación ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        variant="danger"
        title="¿Eliminar esta cotización?"
        description={deleteTarget ? `La cotización ${deleteTarget.code} será eliminada permanentemente.` : ''}
        confirmLabel="Eliminar"
      />
    </div>
  );
};

export default QuotesPage;
