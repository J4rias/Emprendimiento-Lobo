import { FileText } from '@phosphor-icons/react';
import { Card } from '../ui';
import { formatMoney } from '../../utils/formatUtils';

const fmt = (v: number | string): string => formatMoney(v, '', 2).trim();

interface CurrencyBalance {
  total_ocs: number | string;
  total_paid: number | string;
  balance: number | string;
}

interface SupplierBalanceSummaryProps {
  summary: Record<string, CurrencyBalance> | null;
}

export function SupplierBalanceSummary({ summary }: SupplierBalanceSummaryProps) {
  if (!summary || Object.keys(summary).length === 0) return null;

  return (
    <Card variant="flat" className="border-l-4 border-primary-500">
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary-500" />
        Estado de Cuenta del Proveedor
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(summary).map(([currency, data]) => (
          <div key={currency} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">{currency}</div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Total facturado:</span>
              <span className="font-medium text-gray-900">{fmt(data.total_ocs)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Total pagado:</span>
              <span className="font-medium text-green-600">{fmt(data.total_paid)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-1 border-t border-gray-300">
              <span className="font-bold text-gray-700">
                {parseFloat(data.balance) < 0 ? 'Saldo a favor:' : 'Saldo pendiente:'}
              </span>
              <span
                className={`font-bold ${parseFloat(data.balance) < 0 ? 'text-green-600' : 'text-primary-600'}`}
              >
                {fmt(Math.abs(parseFloat(data.balance)))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
