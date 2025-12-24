import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  DollarSign,
  Calendar,
  Download,
  RefreshCw,
  Package,
  TrendingUp,
  ArrowRightLeft
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ReportsPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [valuationData, setValuationData] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [convertedValues, setConvertedValues] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const currencies = [
    { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
    { code: 'COP', name: 'Peso Colombiano', symbol: '$' },
    { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs' }
  ];

  useEffect(() => {
    fetchValuationReport();
  }, [selectedDate]);

  useEffect(() => {
    if (valuationData && selectedCurrency !== 'USD') {
      convertAllCurrencies();
    }
  }, [selectedCurrency, valuationData]);

  const fetchValuationReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/inventory/valuation?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setValuationData(data.data);
      }
    } catch (error) {
      console.error('Error fetching valuation:', error);
    } finally {
      setLoading(false);
    }
  };

  const convertAllCurrencies = async () => {
    if (!valuationData?.totalValue) return;

    const converted = {};

    for (const currency of currencies) {
      if (currency.code === 'USD') {
        converted[currency.code] = {
          amount: valuationData.totalValue,
          rate: 1
        };
        continue;
      }

      try {
        const response = await fetch(
          `${API_URL}/exchange-rates/convert?amount=${valuationData.totalValue}&from_currency=USD&to_currency=${currency.code}&date=${selectedDate}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          converted[currency.code] = {
            amount: data.data.converted_amount,
            rate: data.data.rate
          };
        }
      } catch (error) {
        console.error(`Error converting to ${currency.code}:`, error);
      }
    }

    setConvertedValues(converted);
  };

  const exportReport = () => {
    // Create CSV content
    const csvRows = [
      ['Reporte de Valoración de Inventario'],
      ['Fecha', selectedDate],
      [''],
      ['Moneda', 'Valor Total', 'Tasa de Cambio (desde USD)'],
    ];

    currencies.forEach(currency => {
      const value = currency.code === 'USD'
        ? valuationData?.totalValue || 0
        : convertedValues[currency.code]?.amount || 0;
      const rate = currency.code === 'USD'
        ? 1
        : convertedValues[currency.code]?.rate || 0;

      csvRows.push([
        `${currency.code} - ${currency.name}`,
        value.toFixed(2),
        rate.toFixed(6)
      ]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `valuation_report_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes de Valoración</h1>
          <p className="text-gray-600">Análisis multimoneda del inventario</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchValuationReport}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={exportReport}
            disabled={!valuationData}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="card">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de valoración
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input max-w-xs"
            />
          </div>
        </div>
      </div>

      {/* Multi-Currency Valuation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currencies.map((currency) => {
          const value = currency.code === 'USD'
            ? valuationData?.totalValue || 0
            : convertedValues[currency.code]?.amount || 0;
          const rate = currency.code === 'USD'
            ? 1
            : convertedValues[currency.code]?.rate || 0;

          return (
            <div
              key={currency.code}
              className={`card ${selectedCurrency === currency.code ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setSelectedCurrency(currency.code)}
              style={{ cursor: 'pointer' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">{currency.code}</p>
                  <p className="text-xs text-gray-500">{currency.name}</p>
                </div>
                <div className="bg-green-100 p-2 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>

              <p className="text-2xl font-bold text-gray-900 mb-2">
                {currency.symbol} {value.toFixed(2)}
              </p>

              {currency.code !== 'USD' && rate > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <ArrowRightLeft className="h-3 w-3" />
                  <span>1 USD = {rate.toFixed(2)} {currency.code}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Report Table */}

      {/* Purchase Currency Totals Section */}
      {valuationData?.totalsByCurrency && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Totales por Moneda de Compra
            </h2>
            <p className="text-sm text-gray-500">
              Valores en la moneda original de cada producto
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currencies.map((currency) => {
              const total = valuationData.totalsByCurrency[currency.code] || 0;
              
              return (
                <div
                  key={`purchase-${currency.code}`}
                  className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-blue-600 uppercase">{currency.code}</p>
                      <p className="text-xs text-blue-500">{currency.name}</p>
                    </div>
                    <div className="bg-blue-200 p-2 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-blue-700" />
                    </div>
                  </div>

                  <p className="text-2xl font-bold text-blue-900">
                    {currency.symbol} {total.toFixed(2)}
                  </p>
                  
                  <p className="text-xs text-blue-600 mt-1">
                    Total en {currency.code}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Nota:</strong> Estos valores representan el costo total del inventario en cada moneda original de compra. 
              Para ver valores convertidos a una moneda específica, use las tarjetas superiores.
            </p>
          </div>
        </div>
      )}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Desglose por Moneda
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Moneda</th>
                <th>Valor Base (USD)</th>
                <th>Tasa de Cambio</th>
                <th>Valor Convertido</th>
                <th>Diferencia vs USD</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((currency) => {
                const baseValue = valuationData?.totalValue || 0;
                const convertedAmount = currency.code === 'USD'
                  ? baseValue
                  : convertedValues[currency.code]?.amount || 0;
                const rate = currency.code === 'USD'
                  ? 1
                  : convertedValues[currency.code]?.rate || 0;
                const difference = convertedAmount - baseValue;

                return (
                  <tr key={currency.code}>
                    <td>
                      <div>
                        <div className="font-medium">{currency.code}</div>
                        <div className="text-sm text-gray-500">{currency.name}</div>
                      </div>
                    </td>
                    <td className="font-mono">${baseValue.toFixed(2)}</td>
                    <td className="font-mono">
                      {rate.toFixed(6)}
                    </td>
                    <td className="font-mono font-semibold">
                      {currency.symbol} {convertedAmount.toFixed(2)}
                    </td>
                    <td>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        difference > 0
                          ? 'bg-green-100 text-green-800'
                          : difference < 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {difference > 0 ? '+' : ''}{difference.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-6 w-6 text-blue-600 mt-1" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Sobre este reporte</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Los valores se calculan usando las tasas de cambio configuradas para la fecha seleccionada</li>
              <li>• El valor base siempre se calcula en USD y se convierte a otras monedas</li>
              <li>• Si no hay tasa para la fecha exacta, se usa la tasa más reciente disponible</li>
              <li>• Puedes exportar el reporte a CSV para análisis adicional</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-700">Generando reporte...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
