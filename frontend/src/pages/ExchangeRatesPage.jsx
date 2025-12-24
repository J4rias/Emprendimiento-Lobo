import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  TrendingUp,
  X,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ExchangeRatesPage = () => {
  const { token, hasPermission } = useAuth();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    from_currency: 'USD',
    to_currency: 'VES',
    rate: '',
    effective_date: new Date().toISOString().split('T')[0],
    source: 'Manual',
    notes: ''
  });

  const currencies = [
    { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
    { code: 'COP', name: 'Peso Colombiano', symbol: '$' },
    { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs' }
  ];

  useEffect(() => {
    fetchRates();
  }, [currentPage, selectedDate]);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        date_from: selectedDate,
        date_to: selectedDate
      });

      const response = await fetch(`${API_URL}/exchange-rates?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Error al cargar tasas de cambio');

      const data = await response.json();
      setRates(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = editingRate
        ? `${API_URL}/exchange-rates/${editingRate.id}`
        : `${API_URL}/exchange-rates`;

      const method = editingRate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar tasa de cambio');
      }

      await fetchRates();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rate) => {
    setEditingRate(rate);
    setFormData({
      from_currency: rate.from_currency,
      to_currency: rate.to_currency,
      rate: rate.rate,
      effective_date: rate.effective_date,
      source: rate.source || 'Manual',
      notes: rate.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar esta tasa de cambio?')) return;

    try {
      const response = await fetch(`${API_URL}/exchange-rates/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar tasa');
      }

      await fetchRates();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRate(null);
    setFormData({
      from_currency: 'USD',
      to_currency: 'VES',
      rate: '',
      effective_date: new Date().toISOString().split('T')[0],
      source: 'Manual',
      notes: ''
    });
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getCurrencySymbol = (code) => {
    return currencies.find(c => c.code === code)?.symbol || code;
  };

  const getCurrencyName = (code) => {
    return currencies.find(c => c.code === code)?.name || code;
  };

  if (loading && rates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando tasas de cambio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasas de Cambio</h1>
          <p className="text-gray-600">Gestión de tasas de cambio diarias para valoración multimoneda</p>
        </div>
        {hasPermission('settings.manage') && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nueva Tasa
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Date Filter */}
      <div className="card">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de consulta
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              className="input max-w-xs"
            />
          </div>
          <button
            onClick={fetchRates}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Exchange Rates Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Desde</th>
                <th>Hacia</th>
                <th>Tasa</th>
                <th>Fecha Efectiva</th>
                <th>Fuente</th>
                <th>Creado por</th>
                {hasPermission('settings.manage') && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    No se encontraron tasas de cambio para esta fecha
                  </td>
                </tr>
              ) : (
                rates.map((rate) => (
                  <tr key={rate.id}>
                    <td>
                      <div>
                        <div className="font-medium">{rate.from_currency}</div>
                        <div className="text-sm text-gray-500">
                          {getCurrencyName(rate.from_currency)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="font-medium">{rate.to_currency}</div>
                        <div className="text-sm text-gray-500">
                          {getCurrencyName(rate.to_currency)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="font-mono text-lg font-semibold">
                          {parseFloat(rate.rate).toFixed(6)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        1 {rate.from_currency} = {parseFloat(rate.rate).toFixed(2)} {rate.to_currency}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {new Date(rate.effective_date + 'T00:00:00').toLocaleDateString('es-VE')}
                      </div>
                    </td>
                    <td>
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {rate.source || 'Manual'}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm">
                        {rate.creator?.first_name || rate.creator?.username || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(rate.created_at).toLocaleString('es-VE')}
                      </div>
                    </td>
                    {hasPermission('settings.manage') && (
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(rate)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rate.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Reference Card */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <DollarSign className="h-6 w-6 text-blue-600 mt-1" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Sobre las Tasas de Cambio</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Las tasas se aplican a la valoración de inventario en diferentes monedas</li>
              <li>• Debe registrar tasas para cada par de monedas que utilice</li>
              <li>• Si no hay tasa para un día específico, el sistema usará la más reciente</li>
              <li>• Se recomienda actualizar las tasas diariamente para mayor precisión</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRate ? 'Editar Tasa de Cambio' : 'Nueva Tasa de Cambio'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moneda Origen *
                  </label>
                  <select
                    name="from_currency"
                    value={formData.from_currency}
                    onChange={handleChange}
                    required
                    className="input"
                  >
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moneda Destino *
                  </label>
                  <select
                    name="to_currency"
                    value={formData.to_currency}
                    onChange={handleChange}
                    required
                    className="input"
                  >
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tasa de Cambio *
                </label>
                <input
                  type="number"
                  name="rate"
                  value={formData.rate}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.000001"
                  className="input"
                  placeholder="Ej: 36.50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  1 {formData.from_currency} = {formData.rate || '0'} {formData.to_currency}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Efectiva *
                </label>
                <input
                  type="date"
                  name="effective_date"
                  value={formData.effective_date}
                  onChange={handleChange}
                  required
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fuente
                </label>
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="input"
                  placeholder="Ej: BCV, Banco Central, Manual"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  className="input"
                  placeholder="Notas adicionales sobre esta tasa..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : editingRate ? 'Actualizar' : 'Crear Tasa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExchangeRatesPage;
