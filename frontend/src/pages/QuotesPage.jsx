import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Eye, ArrowRightCircle, CheckCircle, XCircle, SendHorizonal } from 'lucide-react';
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
  c?.businessName || c?.business_name || c?.trade_name ||
  `${c?.firstName || c?.first_name || ''} ${c?.lastName || c?.last_name || ''}`.trim() ||
  'Cliente';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-VE') : '—';
const fmtUSD  = (n) => `$ ${parseFloat(n || 0).toFixed(2)}`;

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

  const quotes     = quotesData?.data || quotesData?.quotes || [];
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
    { key: 'code', header: 'Código', render: (v) => <span className="font-mono text-sm">{v}</span> },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_, row) => customerName(row.customer),
    },
    {
      key: 'date',
      header: 'Fecha',
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
      render: (_, row) => (
        <Badge variant={STATUS_VARIANT[row.status] || 'neutral'}>
          {STATUS_LABEL[row.status] || row.status}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (_, row) => fmtUSD(row.total),
      cellClassName: 'text-right font-semibold',
    },
    {
      key: 'actions',
      header: '',
      render: (_, row) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => setSelectedQuote(row)} title="Ver detalles">
            <Eye className="h-4 w-4" />
          </Button>
          {hasPermission('sales.quotes.update') && row.status === 'approved' && (
            <Button
              variant="ghost" size="icon-sm"
              className="text-teal-600 hover:bg-teal-50"
              onClick={() => setConvertTarget(row)}
              title="Convertir a venta"
            >
              <ArrowRightCircle className="h-4 w-4" />
            </Button>
          )}
          {hasPermission('sales.quotes.delete') && row.status === 'draft' && (
            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(row)} title="Eliminar">
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
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
          <div className="space-y-5">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Cliente</p>
                <p className="text-gray-900 font-medium">{customerName(selectedQuote.customer)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Estado</p>
                <Badge variant={STATUS_VARIANT[selectedQuote.status] || 'neutral'}>
                  {STATUS_LABEL[selectedQuote.status] || selectedQuote.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Fecha</p>
                <p className="text-gray-900">{fmtDate(selectedQuote.quote_date || selectedQuote.quoteDate || selectedQuote.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Vence</p>
                <p className="text-gray-900">{fmtDate(selectedQuote.valid_until || selectedQuote.validUntil)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Vendedor</p>
                <p className="text-gray-900">{selectedQuote.user?.first_name} {selectedQuote.user?.last_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Moneda</p>
                <p className="text-gray-900">{selectedQuote.currency || 'USD'}</p>
              </div>
              {selectedQuote.converted_to_sale_id && (
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Venta generada</p>
                  <p className="text-teal-700 font-medium">ID #{selectedQuote.converted_to_sale_id}</p>
                </div>
              )}
            </div>

            {/* Product lines */}
            {selectedQuote.details && selectedQuote.details.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Productos</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Producto</th>
                        <th className="text-right px-3 py-2">Cant.</th>
                        <th className="text-right px-3 py-2">P.Unit</th>
                        <th className="text-right px-3 py-2">Desc.</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedQuote.details.map((d, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800">{d.product?.name || d.description}</p>
                            {d.presentation && (
                              <p className="text-xs text-gray-400">{d.presentation.name}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{parseFloat(d.quantity)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{fmtUSD(d.unit_price)}</td>
                          <td className="px-3 py-2 text-right text-gray-500">
                            {parseFloat(d.discount_percentage || 0) > 0 ? `${parseFloat(d.discount_percentage)}%` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmtUSD(d.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedQuote.notes && (
              <div className="text-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Notas</p>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedQuote.notes}</p>
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
              {parseFloat(selectedQuote.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Descuento</span>
                  <span>- {fmtUSD(selectedQuote.discount_amount)}</span>
                </div>
              )}
              {parseFloat(selectedQuote.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>IVA ({parseFloat(selectedQuote.tax_percentage || 0)}%)</span>
                  <span>{fmtUSD(selectedQuote.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span>
                <span>{fmtUSD(selectedQuote.total)}</span>
              </div>
            </div>

            {/* Action buttons — status workflow */}
            {hasPermission('sales.quotes.update') && selectedQuote.status !== 'converted' && (
              <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-2 justify-end">
                {['draft', 'sent'].includes(selectedQuote.status) && (
                  <>
                    <Button
                      variant="secondary" size="sm"
                      loading={statusMutation.isPending}
                      onClick={() => handleStatusChange(selectedQuote, 'sent')}
                      disabled={selectedQuote.status === 'sent'}
                    >
                      <SendHorizonal className="h-4 w-4" /> Marcar enviada
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-600 hover:bg-red-50"
                      loading={statusMutation.isPending}
                      onClick={() => handleStatusChange(selectedQuote, 'rejected')}
                    >
                      <XCircle className="h-4 w-4" /> Rechazar
                    </Button>
                    <Button
                      size="sm"
                      loading={statusMutation.isPending}
                      onClick={() => handleStatusChange(selectedQuote, 'approved')}
                    >
                      <CheckCircle className="h-4 w-4" /> Aprobar
                    </Button>
                  </>
                )}
                {selectedQuote.status === 'approved' && (
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => { setConvertTarget(selectedQuote); setSelectedQuote(null); }}
                  >
                    <ArrowRightCircle className="h-4 w-4" /> Convertir a Venta
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

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
