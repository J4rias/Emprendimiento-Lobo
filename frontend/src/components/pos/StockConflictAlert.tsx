import React from 'react';
import { WarningCircle } from '@phosphor-icons/react';

/**
 * Stock Conflict Alert Component
 * Shows detailed information about stock conflicts during POS operations
 */
interface StockConflictAlertProps {
  show: boolean;
  productName: string;
  requested: number | string;
  available: number | string;
  reservedByOthers: number | string;
  onDismiss: () => void;
}

export function StockConflictAlert({
  show,
  productName,
  requested,
  available,
  reservedByOthers,
  onDismiss
}: StockConflictAlertProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <WarningCircle className="w-6 h-6 text-red-500" />
          <h2 className="text-lg font-bold text-gray-900">Stock Insuficiente</h2>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-700">
            <strong>{productName}</strong> no tiene suficiente stock disponible.
          </p>

          {/* Stock details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Stock total:</span>
              <span className="font-semibold">{(parseFloat(available) + parseFloat(reservedByOthers)).toFixed(2)} uds</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Reservado por otros:</span>
              <span className="font-semibold text-amber-600">{parseFloat(reservedByOthers || 0).toFixed(2)} uds</span>
            </div>

            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span className="text-gray-700">Disponible para ti:</span>
              <span className="text-green-600">{Math.max(0, parseFloat(available || 0)).toFixed(2)} uds</span>
            </div>

            <div className="border-t pt-2 flex justify-between text-sm font-semibold bg-red-50 -mx-4 -my-2 px-4 py-2 rounded-b">
              <span className="text-red-700">Solicitaste:</span>
              <span className="text-red-700">{parseFloat(requested || 0).toFixed(2)} uds</span>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Otro vendedor está usando parte del stock. Intenta con una cantidad menor o espera a que libere el stock.
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={onDismiss}
          className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export default StockConflictAlert;
