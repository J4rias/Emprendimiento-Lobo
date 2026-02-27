import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit, Trash2, Eye, X, AlertCircle } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { customerService } from '../services/api/customerService';

const CustomersPage = () => {
  const { hasPermission } = useAuth();
  const searchInputRef = useRef(null);
  const wasSearchFocused = useRef(false);
  const cursorPosition = useRef(0);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);

  const [formData, setFormData] = useState({
    type: 'natural',
    documentType: 'DNI',
    documentNumber: '',
    businessName: '',
    tradeName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    city: '',
    state: '',
    country: 'Perú',
    postalCode: '',
    creditLimit: 0,
    creditDays: 0,
    priceListId: null,
    discountPercentage: 0,
    notes: ''
  });

  const statusLabels = {
    active: { text: 'Activo', class: 'bg-green-100 text-green-800' },
    inactive: { text: 'Inactivo', class: 'bg-gray-100 text-gray-800' },
    blocked: { text: 'Bloqueado', class: 'bg-red-100 text-red-800' },
  };

  // Debounce search to avoid losing focus
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Track focus before debounced search triggers
  useEffect(() => {
    if (document.activeElement === searchInputRef.current) {
      wasSearchFocused.current = true;
      cursorPosition.current = searchInputRef.current?.selectionStart || 0;
    }
  }, [debouncedSearch]);

  // Restore focus after loading completes
  useEffect(() => {
    if (!loading && wasSearchFocused.current && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.setSelectionRange(cursorPosition.current, cursorPosition.current);
      wasSearchFocused.current = false;
    }
  }, [loading]);

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, debouncedSearch, typeFilter, statusFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 20,
        search: debouncedSearch,
        type: typeFilter || undefined,
        status: statusFilter || undefined
      };
      const response = await customerService.getAll(params);
      setCustomers(response.data);
      setTotalPages(response.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError('Error al cargar los clientes');
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, formData);
      } else {
        await customerService.create(formData);
      }
      fetchCustomers();
      handleCloseModal();
    } catch (err) {
      setError('Error al guardar el cliente');
      console.error('Error saving customer:', err);
      if (err.response) {
        console.error('Error response:', err.response.data);
      }
    }
  };

  const handleView = (customer) => {
    setViewingCustomer(customer);
    setShowViewModal(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      type: customer.type || 'natural',
      documentType: customer.documentType || 'DNI',
      documentNumber: customer.documentNumber || '',
      businessName: customer.businessName || '',
      tradeName: customer.tradeName || '',
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      mobile: customer.mobile || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      country: customer.country || 'Perú',
      postalCode: customer.postalCode || '',
      creditLimit: customer.creditLimit || 0,
      creditDays: customer.creditDays || 0,
      priceListId: customer.priceListId || null,
      discountPercentage: customer.discountPercentage || 0,
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar este cliente?')) {
      try {
        await customerService.delete(id);
        fetchCustomers();
      } catch (err) {
        setError('Error al eliminar el cliente');
        console.error('Error deleting customer:', err);
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData({
      type: 'natural',
      documentType: 'DNI',
      documentNumber: '',
      businessName: '',
      tradeName: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      mobile: '',
      address: '',
      city: '',
      state: '',
      country: 'Perú',
      postalCode: '',
      creditLimit: 0,
      creditDays: 0,
      priceListId: null,
      discountPercentage: 0,
      notes: ''
    });
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const columns = [
    { header: 'Código', accessor: 'code' },
    {
      header: 'Nombre/Razón Social',
      accessor: (row) => row.type === 'juridical'
        ? (row.businessName || row.tradeName)
        : `${row.firstName} ${row.lastName}`,
    },
    {
      header: 'Tipo',
      accessor: (row) => row.type === 'natural' ? 'Natural' : 'Jurídica',
    },
    {
      header: 'Documento',
      accessor: (row) => `${row.documentType} ${row.documentNumber}`,
    },
    {
      header: 'Email',
      accessor: 'email',
    },
    {
      header: 'Teléfono',
      accessor: (row) => row.phone || row.mobile || '-',
    },
    {
      header: 'Estado',
      accessor: (row) => {
        const status = statusLabels[row.status] || statusLabels.active;
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.class}`}>
            {status.text}
          </span>
        );
      },
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleView(row)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Ver detalles"
          >
            <Eye className="h-4 w-4" />
          </button>
          {hasPermission('customers.update') && (
            <button
              onClick={() => handleEdit(row)}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          {hasPermission('customers.delete') && (
            <button
              onClick={() => handleDelete(row.id)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600 mt-1">Gestiona la información de tus clientes</p>
        </div>
        {hasPermission('customers.create') && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nuevo Cliente
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre, documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input"
          >
            <option value="">Todos los tipos</option>
            <option value="natural">Persona Natural</option>
            <option value="juridical">Persona Jurídica</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={customers}
          loading={loading}
          emptyMessage="No se encontraron clientes. Crea tu primer cliente usando el botón 'Nuevo Cliente'."
        />
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={handleCloseModal}
          title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
          size="large"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cliente *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="input"
                  required
                >
                  <option value="natural">Persona Natural</option>
                  <option value="juridical">Persona Jurídica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Documento *
                </label>
                <select
                  name="documentType"
                  value={formData.documentType}
                  onChange={handleChange}
                  className="input"
                  required
                >
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">CE</option>
                  <option value="PASSPORT">Pasaporte</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de Documento *
              </label>
              <input
                type="text"
                name="documentNumber"
                value={formData.documentNumber}
                onChange={handleChange}
                className="input"
                required
              />
            </div>

            {/* Name Fields - Conditional based on type */}
            {formData.type === 'natural' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="input"
                    required={formData.type === 'natural'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="input"
                    required={formData.type === 'natural'}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    className="input"
                    required={formData.type === 'juridical'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Comercial
                  </label>
                  <input
                    type="text"
                    name="tradeName"
                    value={formData.tradeName}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>
            )}

            {/* Contact Information */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Móvil
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departamento/Estado
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  País
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código Postal
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            {/* Credit Information */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium text-gray-900 mb-3">Información de Crédito</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Límite de Crédito ($)
                  </label>
                  <input
                    type="number"
                    name="creditLimit"
                    value={formData.creditLimit}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Días de Crédito
                  </label>
                  <input
                    type="number"
                    name="creditDays"
                    value={formData.creditDays}
                    onChange={handleChange}
                    min="0"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descuento (%)
                  </label>
                  <input
                    type="number"
                    name="discountPercentage"
                    value={formData.discountPercentage}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.01"
                    className="input"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
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
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleCloseModal}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                {editingCustomer ? 'Actualizar' : 'Crear'} Cliente
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Modal */}
      {showViewModal && viewingCustomer && (
        <Modal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setViewingCustomer(null);
          }}
          title={`Cliente ${viewingCustomer.code}`}
          size="large"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <p className="mt-1 text-gray-900">
                  {viewingCustomer.type === 'natural' ? 'Persona Natural' : 'Persona Jurídica'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Estado</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusLabels[viewingCustomer.status].class}`}>
                    {statusLabels[viewingCustomer.status].text}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Documento</label>
                <p className="mt-1 text-gray-900">
                  {viewingCustomer.documentType} {viewingCustomer.documentNumber}
                </p>
              </div>
              {viewingCustomer.type === 'natural' ? (
                <div>
                  <label className="text-sm font-medium text-gray-700">Nombre Completo</label>
                  <p className="mt-1 text-gray-900">
                    {viewingCustomer.firstName} {viewingCustomer.lastName}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Razón Social</label>
                    <p className="mt-1 text-gray-900">{viewingCustomer.businessName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nombre Comercial</label>
                    <p className="mt-1 text-gray-900">{viewingCustomer.tradeName || '-'}</p>
                  </div>
                </>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{viewingCustomer.email || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Teléfono</label>
                <p className="mt-1 text-gray-900">{viewingCustomer.phone || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Móvil</label>
                <p className="mt-1 text-gray-900">{viewingCustomer.mobile || '-'}</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Dirección</label>
                <p className="mt-1 text-gray-900">{viewingCustomer.address || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Límite de Crédito</label>
                <p className="mt-1 text-gray-900">
                  $ {parseFloat(viewingCustomer.creditLimit || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Días de Crédito</label>
                <p className="mt-1 text-gray-900">{viewingCustomer.creditDays || 0} días</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Descuento</label>
                <p className="mt-1 text-gray-900">{parseFloat(viewingCustomer.discountPercentage || 0).toFixed(2)}%</p>
              </div>
            </div>

            {viewingCustomer.notes && (
              <div>
                <label className="text-sm font-medium text-gray-700">Notas</label>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{viewingCustomer.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CustomersPage;
