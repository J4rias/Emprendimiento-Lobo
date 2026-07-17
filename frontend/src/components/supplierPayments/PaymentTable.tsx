import { Badge, Table, ViewAction, EditAction, CancelAction } from '../ui';
import { formatMoney, formatDateShort } from '../../utils/formatUtils';

const STATUS_LABEL = { recorded: 'Registrado', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_VARIANT = { recorded: 'warning', confirmed: 'success', cancelled: 'error' };

const METHOD_LABEL = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  check: 'Cheque',
  card: 'Tarjeta',
  other: 'Otro',
  credit_balance: 'Saldo a Favor',
  usdt: 'USDT',
};
const METHOD_VARIANT = {
  cash: 'success',
  transfer: 'info',
  check: 'purple',
  card: 'warning',
  other: 'neutral',
  credit_balance: 'purple',
  usdt: 'usdt',
};

const fmtAmt = (v: number | string, currency?: string): string =>
  formatMoney(v, currency || '', 2);

interface SupplierPayment {
  id: number;
  payment_number?: string;
  payment_date?: string;
  supplier?: { name: string; company_name?: string };
  allocations?: Array<{
    id: number;
    purchase_order_id: number;
    purchaseOrder?: { order_number?: string };
    allocated_amount: number | string;
  }>;
  status: string;
  payment_method: string;
  amount: number | string;
  currency?: string;
  reference?: string;
  creator?: { first_name?: string; last_name?: string; username?: string };
}

interface PaymentTableProps {
  payments: SupplierPayment[];
  loading: boolean;
  onView: (payment: SupplierPayment) => void;
  onEdit: (payment: SupplierPayment) => void;
  onCancel: (payment: SupplierPayment) => void;
  hasPermission: (permission: string) => boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

export function PaymentTable({ payments, loading, onView, onEdit, onCancel, hasPermission, sortBy, sortDir, onSort }: PaymentTableProps) {
  const columns = [
    {
      header: 'Número',
      accessor: 'payment_number',
      sortable: true,
      sortKey: 'payment_number',
      render: (_, p) => (
        <div>
          <div className="font-medium text-gray-900">{p.payment_number || 'N/A'}</div>
          <div className="text-xs text-gray-500">
            {p.payment_date ? formatDateShort(p.payment_date) : 'N/A'}
          </div>
        </div>
      ),
    },
    {
      header: 'Proveedor',
      accessor: 'supplier',
      render: (_, p) => (
        <div>
          <div className="font-medium text-gray-900">{p.supplier?.name}</div>
          <div className="text-xs text-gray-500">{p.supplier?.company_name}</div>
        </div>
      ),
    },
    {
      header: 'Órdenes de compra',
      accessor: 'allocations',
      render: (_, p) => {
        const allocs = p.allocations || [];
        if (allocs.length === 0)
          return <span className="text-xs text-gray-400">Sin asignación</span>;
        if (allocs.length === 1)
          return (
            <span className="text-sm text-primary-600">
              {allocs[0].purchaseOrder?.order_number || `OC #${allocs[0].purchase_order_id}`}
            </span>
          );
        const tooltip = allocs
          .map((a) => a.purchaseOrder?.order_number || `OC #${a.purchase_order_id}`)
          .join('\n');
        return (
          <span className="text-sm text-primary-600 cursor-default" title={tooltip}>
            {allocs.length} órdenes
          </span>
        );
      },
    },
    {
      header: 'Estado',
      accessor: 'status',
      sortable: true,
      sortKey: 'status',
      render: (_, p) => (
        <Badge variant={STATUS_VARIANT[p.status] ?? 'neutral'}>
          {STATUS_LABEL[p.status] ?? p.status}
        </Badge>
      ),
    },
    {
      header: 'Método',
      accessor: 'payment_method',
      render: (_, p) => (
        <Badge variant={METHOD_VARIANT[p.payment_method] ?? 'neutral'}>
          {METHOD_LABEL[p.payment_method] ?? p.payment_method}
        </Badge>
      ),
    },
    {
      header: 'Monto',
      accessor: 'amount',
      sortable: true,
      sortKey: 'amount',
      cellClassName: 'text-right',
      render: (_, p) => (
        <div className="text-right">
          <div className="font-medium text-gray-900">{fmtAmt(p.amount, p.currency)}</div>
          {p.reference && <div className="text-xs text-gray-500">Ref: {p.reference}</div>}
        </div>
      ),
    },
    {
      header: 'Registrado por',
      accessor: 'creator',
      render: (_, p) => (
        <span className="text-sm text-gray-600">
          {[p.creator?.first_name, p.creator?.last_name].filter(Boolean).join(' ') ||
            p.creator?.username ||
            'N/A'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      accessor: 'id',
      render: (_, p) => (
        <div className="flex items-center gap-1">
          <ViewAction onClick={() => onView(p)} />
          {hasPermission('supplier_payments.update') && p.status !== 'cancelled' && (
            <EditAction onClick={() => onEdit(p)} />
          )}
          {hasPermission('supplier_payments.delete') && p.status !== 'cancelled' && (
            <CancelAction onClick={() => onCancel(p)} title="Anular" />
          )}
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={payments ?? []}
      loading={loading}
      emptyMessage="No se encontraron pagos"
      rowClassName={(p) => (p.status === 'cancelled' ? 'opacity-60' : '')}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
    />
  );
}
