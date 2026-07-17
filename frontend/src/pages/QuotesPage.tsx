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
const STATUS_VARIANT: Record<string, string> = {
  draft: 'neutral', sent: 'info', approved: 'success',
  rejected: 'error', converted: 'purple', expired: 'warning',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', approved: 'Aprobada',
  rejected: 'Rechazada', converted: 'Convertida', expired: 'Vencida',
};

interface QuoteRow {
  id: number;
  code?: string;
  status: string;
  total: number;
  customer?: {
    businessName?: string;
    business_name?: string;
    trade_name?: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    [key: string]: unknown;
  };
  quote_date?: string;
  quoteDate?: string;
  created_at?: string;
  valid_until?: string;
  validUntil?: string;
  [key: string]: unknown;
}

interface ConversionResult {
  sale_number: string;
  quote_code: string;
}

const customerName = (c: QuoteRow['customer']) =>
  c?.businessName || c?.business_name || c?.trade_name ||
  `${c?.firstName || c?.first_name || ''} ${c?.lastName || c?.last_name || ''}`.trim() ||
  'Cliente';

const fmtDate = (d: string | undefined) => d ? formatDateShort(d) : '';
const fmtUSD  = (n: number | string) => formatUSD(n);

const QuotesPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useTableLimit();

  // ─── Filtros y paginación ────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [selectedQuote, setSelectedQuote]   = useState<QuoteRow | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<QuoteRow | null>(null);
  const [convertTarget, setConvertTarget]   = useState<QuoteRow | null>(null);
  const [lastConversion, setLastConversion] = useState<ConversionResult | null>(null);

  // ─── Sort (server-side) ───────────────────────────────────────────────────────
  const { sortBy: quoteSortBy, sortDir: quoteSortDir, onSort: _quoteOnSort } = useTableSort([], { serverSide: true, defaultField: 'created_at', defaultDir: 'desc' });
  const quoteOnSort = (f: string, d: 'asc' | 'desc') => { _quoteOnSort(f, d); setCurrentPage(1); };

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
    }),
    staleTime: 30_000,
  });

  const quotes: QuoteRow[]     = quotesData?.data || [];
  const pagination = quotesData?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total      = pagination?.total || 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['quotes'] });

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => quoteService.delete(id),
    onSuccess: () => { toast.success('Cotización eliminada'); setDeleteTarget(null); invalidate(); },
    onError:   (err: unknown) => { toast.error((err as any)?.response?.data?.message || 'Error al eliminar'); setDeleteTarget(null); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => quoteService.update(id, { status } as any),
    onSuccess: (_: unknown, vars: { id: number; status: string }) => {
      toast.success(`Cotización marcada como: ${STATUS_LABEL[vars.status] || vars.status}`);
      if (selectedQuote) {
        setSelectedQuote((q) => q ? { ...q, status: vars.status } : q);
      }
      invalidate();
    },
    onError: (err: unknown) => toast.error((err as any)?.response?.data?.message || 'Error al cambiar estado'),
  });

  const convertMutation = useMutation({
    mutationFn: (id: number) => quoteService.convertToSale(id),
    onSuccess: (res: any) => {
      setConvertTarget(null);
      setSelectedQuote(null);
      setLastConversion({ sale_number: res.data?.sale_number, quote_code: res.data?.quote_code });
      invalidate();
    },
    onError: (err: unknown) => {
      setConvertTarget(null);
      toast.error((err as any)?.response?.data?.message || 'Error al convertir la cotización');
    },
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const handleStatusChange = (quote: QuoteRow, newStatus: string) => {
    statusMutation.mutate({ id: quote.id, status: newStatus });
  };

  const handleSearchChange  = (value: string) => { setSearch(value); setCurrentPage(1); };
  const handleStatusFilter  = (e: React.ChangeEvent<HTMLSelectElement>) => { setStatusFilter(e.target.value); setCurrentPage(1); };

  // ─── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    { key: 'code', header: 'Código', sortable: true, sortKey: 'code', render: (v: string) => <span className="font-mono text-sm">{v}</span> },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_: unknown, row: QuoteRow) => customerName(row.customer),
    },
    {
      key: 'date',
      header: 'Fecha',
      sortable: true,
      sortKey: 'quote_date',
      render: (_: unknown, row: QuoteRow) => fmtDate(row.quote_date || row.quoteDate || row.created_at),
    },
    {
      key: 'valid_until',
      header: 'Vence',
      render: (_: unknown, row: QuoteRow) => {
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
      render: (_: unknown, row: QuoteRow) => (
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
      render: (_: unknown, row: QuoteRow) => fmtUSD(row.total),
      cellClassName: 'text-right font-semibold',
    },
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (_: unknown, row: QuoteRow) => (
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
        <Alert variant="success" dismissible autoClose={10000}>
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
          onLimitChange={(l: number) => { setLimit(l); setCurrentPage(1); }}
        />
      </Card>

      {/* ── Sheet ver cotización ─────────────────────────────────────────────── */}
      <QuoteViewSheet
        open={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        quote={selectedQuote}
        hasPermission={hasPermission}
        onStatusChange={handleStatusChange}
        onConvert={(q: QuoteRow) => { setConvertTarget(q); setSelectedQuote(null); }}
        statusMutation={statusMutation}
      />

      {/* ── Confirmar conversión ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={() => { if (convertTarget) convertMutation.mutate(convertTarget.id); }}
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
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
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
