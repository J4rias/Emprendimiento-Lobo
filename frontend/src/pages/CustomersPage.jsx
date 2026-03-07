import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, X, AlertCircle, User, Phone, MapPin, BadgeDollarSign, Receipt } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import CustomerStatementModal from '../components/customers/CustomerStatementModal';
import { useAuth } from '../context/AuthContext';
import { customerService } from '../services/api/customerService';

// Venezuelan document types
const VE_DOC_TYPES = [
  { value: 'V', label: 'V - Venezolano/a' },
  { value: 'E', label: 'E - Extranjero/a' },
  { value: 'J', label: 'J - Jurídico (RIF empresa)' },
  { value: 'G', label: 'G - Gubernamental' },
  { value: 'P', label: 'P - Pasaporte' },
];

const DOC_TYPES_BY_TYPE = {
  natural: ['V', 'E', 'P'],
  juridical: ['J', 'G'],
};

const emptyForm = () => ({
  type: 'natural',
  documentType: 'V',
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
  creditLimit: 0,
  creditDays: 0,
  priceListId: null,
  discountPercentage: 0,
  notes: '',
});

const CustomersPage = () => {
  const { hasPermission } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
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
  const [statementCustomer, setStatementCustomer] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const statusLabels = {
    active: { text: 'Activo', class: 'bg-green-100 text-green-800' },
    inactive: { text: 'Inactivo', class: 'bg-gray-100 text-gray-800' },
    blocked: { text: 'Bloqueado', class: 'bg-red-100 text-red-800' },
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [currentPage, debouncedSearch, typeFilter, statusFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage, limit: 20,
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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, formData);
      } else {
        await customerService.create(formData);
      }
      fetchCustomers();
      handleCloseModal();
    } catch (err) {
      console.error('Save error:', err);
      let msg = 'Error al guardar el cliente.';

      if (err.response?.data) {
        const data = err.response.data;
        if (data.message) msg = data.message;

        // Handle Sequelize/Backend validation array
        if (data.errors && Array.isArray(data.errors)) {
          const detail = data.errors.map(e => e.message).join(', ');
          msg = `${msg}: ${detail}`;
        }
      }

      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleView = (customer) => { setViewingCustomer(customer); setShowViewModal(true); };
  const handleShowStatement = (customer) => { setStatementCustomer(customer); };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      type: customer.type || 'natural',
      documentType: customer.documentType || 'V',
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
      creditLimit: customer.creditLimit || 0,
      creditDays: customer.creditDays || 0,
      priceListId: customer.priceListId || null,
      discountPercentage: customer.discountPercentage || 0,
      notes: customer.notes || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar este cliente?')) {
      try {
        await customerService.delete(id);
        fetchCustomers();
      } catch (err) {
        setError(err.response?.data?.message || 'Error al eliminar el cliente');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(emptyForm());
    setFormError(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'type') {
      const validDocs = DOC_TYPES_BY_TYPE[value];
      setFormData(prev => ({
        ...prev,
        type: value,
        documentType: validDocs.includes(prev.documentType) ? prev.documentType : validDocs[0],
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const availableDocTypes = VE_DOC_TYPES.filter(d => DOC_TYPES_BY_TYPE[formData.type]?.includes(d.value));

  const columns = [
    { header: 'Código', accessor: 'code' },
    {
      header: 'Nombre / Razón Social',
      accessor: (row) => row.type === 'juridical'
        ? (row.businessName || row.tradeName)
        : `${row.firstName} ${row.lastName}`,
    },
    { header: 'Tipo', accessor: (row) => row.type === 'natural' ? 'Natural' : 'Jurídica' },
    { header: 'Documento', accessor: (row) => `${row.documentType}-${row.documentNumber}` },
    { header: 'Teléfono', accessor: (row) => row.phone || row.mobile || '-' },
    {
      header: 'Estado',
      accessor: (row) => {
        const s = statusLabels[row.status] || statusLabels.active;
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${s.class}`}>{s.text}</span>;
      },
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex gap-2">
          <button onClick={() => handleView(row)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Ver detalles">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => handleShowStatement(row)} className="p-1 text-teal-600 hover:bg-teal-50 rounded" title="Estado de Cuenta (Kardex)">
            <Receipt className="h-4 w-4" />
          </button>
          {hasPermission('customers.update') && (
            <button onClick={() => handleEdit(row)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Editar">
              <Edit className="h-4 w-4" />
            </button>
          )}
          {hasPermission('customers.delete') && (
            <button onClick={() => handleDelete(row.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page-level Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-1 text-sm">Gestiona la información de tus clientes</p>
        </div>
        {hasPermission('customers.create') && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-5 w-5" /> Nuevo Cliente
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input type="text" placeholder="Buscar por nombre, documento..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="input pl-10 w-full" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input">
            <option value="">Todos los tipos</option>
            <option value="natural">Persona Natural</option>
            <option value="juridical">Persona Jurídica</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <DataTable columns={columns} data={customers} loading={loading}
          emptyMessage="No se encontraron clientes. Crea el primero con 'Nuevo Cliente'." />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Anterior</button>
          <span className="px-3 py-1.5 text-sm text-gray-600">{currentPage} / {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Siguiente</button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal isOpen={showModal} onClose={handleCloseModal}
          title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Form-level error */}
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800 flex-1">{formError}</p>
                <button type="button" onClick={() => setFormError(null)} className="text-red-500 hover:text-red-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* ── Identificación ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <User className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Identificación</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Cliente <span className="text-red-500">*</span>
                  </label>
                  <select name="type" value={formData.type} onChange={handleChange} className="input w-full" required>
                    <option value="natural">Persona Natural</option>
                    <option value="juridical">Persona Jurídica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento <span className="text-red-500">*</span>
                  </label>
                  <select name="documentType" value={formData.documentType} onChange={handleChange} className="input w-full" required>
                    {availableDocTypes.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Documento <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-gray-700 text-sm font-bold">
                    {formData.documentType}-
                  </span>
                  <input type="text" name="documentNumber" value={formData.documentNumber}
                    onChange={handleChange} className="input flex-1 rounded-l-none" required
                    placeholder={formData.documentType === 'J' ? 'Ej: 12345678-9' : 'Ej: 12345678'} />
                </div>
              </div>

              {formData.type === 'natural' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                      className="input w-full" required placeholder="Ej: Juan" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apellido <span className="text-red-500">*</span></label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                      className="input w-full" required placeholder="Ej: Pérez" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social <span className="text-red-500">*</span></label>
                    <input type="text" name="businessName" value={formData.businessName} onChange={handleChange}
                      className="input w-full" required placeholder="Ej: Mi Empresa C.A." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                    <input type="text" name="tradeName" value={formData.tradeName} onChange={handleChange}
                      className="input w-full" placeholder="Opcional" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Contacto ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <Phone className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Contacto</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    className="input w-full" placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                    className="input w-full" placeholder="0212-000-0000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                  <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange}
                    className="input w-full" placeholder="0414-000-0000" />
                </div>
              </div>
            </div>

            {/* ── Dirección ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <MapPin className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Dirección</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input type="text" name="address" value={formData.address} onChange={handleChange}
                  className="input w-full" placeholder="Calle, Urbanización, Edificio..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad / Municipio</label>
                  <input type="text" name="city" value={formData.city} onChange={handleChange}
                    className="input w-full" placeholder="Ej: Caracas" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input type="text" name="state" value={formData.state} onChange={handleChange}
                    className="input w-full" placeholder="Ej: Miranda" />
                </div>
              </div>
            </div>

            {/* ── Crédito ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <BadgeDollarSign className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Información de Crédito</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Límite de Crédito (COP)</label>
                  <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange}
                    min="0" step="1" className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Días de Crédito</label>
                  <input type="number" name="creditDays" value={formData.creditDays} onChange={handleChange}
                    min="0" className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descuento (%)</label>
                  <input type="number" name="discountPercentage" value={formData.discountPercentage}
                    onChange={handleChange} min="0" max="100" step="0.01" className="input w-full" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows="2"
                className="input w-full resize-none" placeholder="Observaciones opcionales..." />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button type="button" onClick={handleCloseModal} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : (editingCustomer ? 'Actualizar Cliente' : 'Crear Cliente')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Modal */}
      {showViewModal && viewingCustomer && (
        <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setViewingCustomer(null); }}
          title={`Cliente ${viewingCustomer.code}`} size="lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Tipo</p>
              <p className="text-gray-900">{viewingCustomer.type === 'natural' ? 'Persona Natural' : 'Persona Jurídica'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Estado</p>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusLabels[viewingCustomer.status]?.class}`}>
                {statusLabels[viewingCustomer.status]?.text}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Documento</p>
              <p className="text-gray-900">{viewingCustomer.documentType}-{viewingCustomer.documentNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Nombre / Razón Social</p>
              <p className="text-gray-900">
                {viewingCustomer.type === 'natural'
                  ? `${viewingCustomer.firstName} ${viewingCustomer.lastName}`
                  : viewingCustomer.businessName}
              </p>
            </div>
            {viewingCustomer.email && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Email</p>
                <p className="text-gray-900">{viewingCustomer.email}</p>
              </div>
            )}
            {(viewingCustomer.phone || viewingCustomer.mobile) && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Teléfono</p>
                <p className="text-gray-900">{viewingCustomer.phone || viewingCustomer.mobile}</p>
              </div>
            )}
            {viewingCustomer.address && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Dirección</p>
                <p className="text-gray-900">
                  {viewingCustomer.address}
                  {viewingCustomer.city ? `, ${viewingCustomer.city}` : ''}
                  {viewingCustomer.state ? `, ${viewingCustomer.state}` : ''}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Límite de Crédito</p>
              <p className="text-gray-900">COP {Math.round(parseFloat(viewingCustomer.creditLimit || 0)).toLocaleString('de-DE')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Días de Crédito</p>
              <p className="text-gray-900">{viewingCustomer.creditDays || 0} días</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Descuento</p>
              <p className="text-gray-900">{parseFloat(viewingCustomer.discountPercentage || 0).toFixed(2)}%</p>
            </div>
            {viewingCustomer.notes && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">Notas</p>
                <p className="text-gray-900 whitespace-pre-wrap">{viewingCustomer.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Statement Modal */}
      {statementCustomer && (
        <CustomerStatementModal
          customer={statementCustomer}
          onClose={() => setStatementCustomer(null)}
        />
      )}
    </div>
  );
};

export default CustomersPage;