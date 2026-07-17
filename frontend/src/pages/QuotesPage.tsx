import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { quoteService } from '../services/api/quoteService';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Pagination, SearchInput, Select, Table, useTableLimit,
  ViewAction, ConvertAction, DeleteAction,
} from '../components/ui';
import QuoteViewSheet from '../components/quotes/QuoteViewSheet';
import { formatUSD, formatDateShort } from '../utils/formatUtils';

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
  c?.businessName || c?.business_name || c?.trade_name ||
  `${c?.firstName || c?.first_name || ''} ${c?.lastName || c?.last_name || ''}`.trim() ||
  'Cliente';

const fmtDate = (d) => formatDateShort(d);
const fmtUSD  = (n) => formatUSD(n);

const QuotesPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useTableLimit();

  // ─── Filtros y paginación ────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [selectedQuote, setSelectedQuote]   = useState(null);
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [convertTarget, setConvertTarget]   = useState(null); // quote to convert (confirm)
  const [lastConversion, setLastConversion] = useState(null); // { sale_number, quote_code }

  // ─── Sort (server-side) ───────────────────────────────────────────────────────
  const { sortBy: quoteSortBy, sortDir: quoteSortDir, onSort: _quoteOnSort } = useTableSort([], { serverSide: true, defaultField: 'created_at', defaultDir: 'desc' });
  const quoteOnSort = (f, d) => { _quoteOnSort(f, d); setCurrentPage(1); };

  // ─── Query ───────────────────────────────────────────────────────────────────
  const {
    data: quotesData,
    isLoading,
    isError: fetchError,
  } = useQuery({
    queryKey: ['quotes', currentPage, search, statusFilter, limit, quoteSortBy, quoteSortDir],
    queryFn: () => quoteService.getAll({
      page: currentPage,
      limit,
      ...(search       && { search }),
      ...(statusFilter && { status: statusFilter }),
      sort_by: quoteSortBy,
      sort_dir: quoteSortDir,
    }),
    staleTime: 30_000,
  });

  const quotes     = quotesData?.data || [];
  const pagination = quotesData?.pagination || {};
  const totalPages = pagination.totalPages || pagination.pages || 1;
  const total      = pagination.total || 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['quotes'] });

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => quoteService.delete(id),
    onSuccess: () => { toast.success('Cotización eliminada'); setDeleteTarget(null); invalidate(); },
    onError:   (err) => { toast.error(err.response?.data?.message || 'Error al eliminar'); setDeleteTarget(null); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => quoteService.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      toast.success(`Cotización marcada como: ${STATUS_LABEL[status] || status}`);
      // Refresh the selected quote if open
      if (selectedQuote) {
        setSelectedQuote(q => ({ ...q, status }));
      }
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al cambiar estado'),
  });

  const convertMutation = useMutation({
    mutationFn: (id) => quoteService.convertToSale(id),
    onSuccess: (res) => {
      setConvertTarget(null);
      setSelectedQuote(null);
      setLastConversion({ sale_number: res.data?.sale_number, quote_code: res.data?.quote_code });
      invalidate();
    },
    onError: (err) => {
      setConvertTarget(null);
      toast.error(err.response?.data?.message || 'Error al convertir la cotización');
    },
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const handleStatusChange = (quote, newStatus) => {
    statusMutation.mutate({ id: quote.id, status: newStatus });
  };

  const handleSearchChange  = (value) => { setSearch(value); setCurrentPage(1); };
  const handleStatusFilter  = (e)     => { setStatusFilter(e.target.value); setCurrentPage(1); };

  // ─── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    { key: 'code', header: 'Código', sortable: true, sortKey: 'code', render: (v) => <span className="font-mono text-sm">{v}</span> },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_, row) => customerName(row.customer),
    },
    {
      key: 'date',
      header: 'Fecha',
      sortable: true,
      sortKey: 'quote_date',
      render: (_, row) => fmtDate(row.quote_date || row.quoteDate || row.created_at),
    },
    {
      key: 'valid_until',
      header: 'Vence',
      render: (_, row) => {
        const d = row.valid_until || row.validUntil;
        const expired = d && new Date(d) < new Date() && row.status !== 'converted';
        return <span className={expired ? 'text-red-500 font-medium' : ''}>{fmtDate(d)}</span>;
      },
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      sortKey: 'status',
      render: (_, row) => (
        <Badge variant={STATUS_VARIANT[row.status] || 'neutral'}>
          {STATUS_LABEL[row.status] || row.status}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      sortKey: 'total',
      render: (_, row) => fmtUSD(row.total),
      cellClassName: 'text-right font-semibold',
    },
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (_, row) => (
        <div className="flex gap-1 justify-end">
          <ViewAction onClick={() => setSelectedQuote(row)} />
          {hasPermission('sales.quotes.update') && row.status === 'approved' && (
            <ConvertAction onClick={() => setConvertTarget(row)} />
          )}
          {hasPermission('sales.quotes.delete') && row.status === 'draft' && (
            <DeleteAction onClick={() => setDeleteTarget(row)} />
          )}
        </div>
      ),
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Cabecera ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
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

      {/* ── Conversión exitosa ────────────────────────────────────────────────── */}
      {lastConversion && (
        <Alert variant="success" dismissible onDismiss={() => setLastConversion(null)}>
          Cotización <strong>{lastConversion.quote_code}</strong> convertida a venta{' '}
          <strong>{lastConversion.sale_number}</strong> exitosamente.
        </Alert>
      )}

      {fetchError && (
        <Alert variant="error" dismissible>
          Error al cargar las cotizaciones. Intenta de nuevo.
        </Alert>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <Card variant="flat">
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
          sortBy={quoteSortBy}
          sortDir={quoteSortDir}
          onSort={quoteOnSort}
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

      {/* ── Sheet ver cotización ─────────────────────────────────────────────── */}
      <QuoteViewSheet
        open={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        quote={selectedQuote}
        hasPermission={hasPermission}
        onStatusChange={handleStatusChange}
        onConvert={(q) => { setConvertTarget(q); setSelectedQuote(null); }}
        statusMutation={statusMutation}
      />

      {/* ── Confirmar conversión ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={() => convertMutation.mutate(convertTarget?.id)}
        loading={convertMutation.isPending}
        title="¿Convertir a Venta a Crédito?"
        description={
          convertTarget
            ? `Se creará una venta a crédito para ${customerName(convertTarget.customer)} por ${fmtUSD(convertTarget.total)}. El stock será descontado inmediatamente.`
            : ''
        }
        confirmLabel="Convertir"
      />

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
