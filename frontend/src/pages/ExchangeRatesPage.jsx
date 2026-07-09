import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Plus, CurrencyDollar, Calendar, TrendUp, ArrowClockwise } from '@phosphor-icons/react';
import {
  Button,
  Badge,
  Alert,
  Card,
  EditAction,
  DeleteAction,
  Input,
  ConfirmDialog,
  Modal,
  Table,
} from '../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ExchangeRatesPage = () => {
  const { token, hasPermission } = useAuth();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
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
        headers: { 'Authorization': `Bearer ${token}` },
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

    try {
      const url = editingRate
        ? `${API_URL}/exchange-rates/${editingRate.id}`
        : `${API_URL}/exchange-rates`;

      const response = await fetch(url, {
        method: editingRate ? 'PUT' : 'POST',
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

      toast.success(editingRate ? 'Tasa actualizada' : 'Tasa registrada');
      await fetchRates();
      handleCloseModal();
    } catch (err) {
      toast.error(err.message);
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

  const handleDelete = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    try {
      const response = await fetch(`${API_URL}/exchange-rates/${deleteTargetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar tasa');
      }

      toast.success('Tasa eliminada');
      await fetchRates();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteTargetId(null);
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getCurrencyName = (code) => {
    return currencies.find(c => c.code === code)?.name || code;
  };

  const columns = [
    {
      header: 'Desde',
      render: (_, rate) => (
        <div>
          <div className="font-medium">{rate.from_currency}</div>
          <div className="text-xs text-gray-500">{getCurrencyName(rate.from_currency)}</div>
        </div>
      ),
    },
    {
      header: 'Hacia',
      render: (_, rate) => (
        <div>
          <div className="font-medium">{rate.to_currency}</div>
          <div className="text-xs text-gray-500">{getCurrencyName(rate.to_currency)}</div>
        </div>
      ),
    },
    {
      header: 'Tasa',
      render: (_, rate) => (
        <div>
          <div className="flex items-center gap-2">
            <TrendUp className="h-4 w-4 text-green-600" />
            <span className="font-mono text-lg font-semibold">{parseFloat(rate.rate).toFixed(6)}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            1 {rate.from_currency} = {parseFloat(rate.rate).toFixed(2)} {rate.to_currency}
          </div>
        </div>
      ),
    },
    {
      header: 'Fecha Efectiva',
      render: (_, rate) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          {new Date(rate.effective_date + 'T00:00:00').toLocaleDateString('es-VE')}
        </div>
      ),
    },
    {
      header: 'Fuente',
      render: (_, rate) => <Badge variant="info">{rate.source || 'Manual'}</Badge>,
    },
    {
      header: 'Creado por',
      render: (_, rate) => (
        <div>
          <div className="text-sm">{rate.creator?.first_name || rate.creator?.username || 'N/A'}</div>
          <div className="text-xs text-gray-500">{new Date(rate.created_at).toLocaleString('es-VE')}</div>
        </div>
      ),
    },
    ...(hasPermission('settings.manage') ? [{
      header: 'Acciones',
      className: 'text-right',
      render: (_, rate) => (
        <div className="flex items-center gap-1">
          <EditAction onClick={() => handleEdit(rate)} />
          <DeleteAction onClick={() => handleDelete(rate.id)} />
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasas de Cambio</h1>
          <p className="text-gray-600">Gestión de tasas de cambio diarias para valoración multimoneda</p>
        </div>
        {hasPermission('settings.manage') && (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Nueva Tasa
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert key={error} variant="error" title="Error" dismissible>
          {error}
        </Alert>
      )}

      {/* Date Filter */}
      <Card variant="flat">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de consulta</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
              className="max-w-xs"
            />
          </div>
          <Button variant="secondary" onClick={fetchRates}>
            <ArrowClockwise className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </Card>

      {/* Exchange Rates Table */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={rates}
          loading={loading}
          emptyIcon={CurrencyDollar}
          emptyMessage="No hay tasas para esta fecha"
          emptyDescription="Agrega una tasa de cambio para comenzar"
          emptyAction={hasPermission('settings.manage') ? (
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4" />
              Nueva Tasa
            </Button>
          ) : undefined}
        />
      </Card>

      {/* Quick Reference Card */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <CurrencyDollar className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
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
      </Card>

      {/* Create/PencilSimple Modal */}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingRate ? 'Editar Tasa de Cambio' : 'Nueva Tasa de Cambio'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
            <Button type="submit" form="rate-form" loading={loading}>
              {editingRate ? 'Actualizar' : 'Crear Tasa'}
            </Button>
          </>
        }
      >
        <form id="rate-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda Origen *</label>
              <select name="from_currency" value={formData.from_currency} onChange={handleChange} required className="input">
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda Destino *</label>
              <select name="to_currency" value={formData.to_currency} onChange={handleChange} required className="input">
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tasa de Cambio *</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Efectiva *</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuente</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="input"
              placeholder="Notas adicionales sobre esta tasa..."
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Eliminar tasa de cambio"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
};

export default ExchangeRatesPage;
