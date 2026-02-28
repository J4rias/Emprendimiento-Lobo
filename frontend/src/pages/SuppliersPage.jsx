import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api/axios';
import { Plus, Edit, Trash2, Search, Building, User, Mail, Phone, Eye, Calendar, Clock, AlertCircle, X, Tag, BookText, Contact } from 'lucide-react';
import SupplierContactManager from '../components/suppliers/SupplierContactManager';

const SuppliersPage = () => {
  const { hasPermission } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    tax_id: '',
    payment_terms: '',
    notes: '',
    is_active: true,
    contacts: []
  });

  // Debounce search to avoid losing focus
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchSuppliers();
  }, [currentPage, debouncedSearch]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/suppliers', {
        params: {
          page: currentPage,
          limit: 20,
          search: debouncedSearch
        }
      });
      setSuppliers(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError('Error al cargar los proveedores');
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, formData);
      } else {
        await api.post('/suppliers', formData);
      }
      fetchSuppliers();
      handleCloseModal();
    } catch (err) {
      setError('Error al guardar el proveedor');
      console.error('Error saving supplier:', err);
      if (err.response) {
        console.error('Error response:', err.response.data);
      }
    }
  };

  const handleView = (supplier) => {
    setViewingSupplier(supplier);
    setShowViewModal(true);
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      tax_id: supplier.tax_id || '',
      payment_terms: supplier.payment_terms || '',
      notes: supplier.notes || '',
      is_active: supplier.is_active !== undefined ? supplier.is_active : true,
      contacts: supplier.contacts || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar este proveedor?')) {
      try {
        await api.delete(`/suppliers/${id}`);
        fetchSuppliers();
      } catch (err) {
        setError('Error al eliminar el proveedor');
        console.error('Error deleting supplier:', err);
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setFormData({
      name: '',
      tax_id: '',
      payment_terms: '',
      notes: '',
      is_active: true,
      contacts: []
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-600">Gestión de proveedores</p>
        </div>
        {hasPermission('suppliers.create') && (
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nuevo Proveedor
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

      {/* Search */}
      <div className="card">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Search className="h-4 w-4 inline mr-1" />
            Buscar
          </label>
          <input
            type="text"
            placeholder="Buscar proveedores..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="input"
          />
        </div>
      </div>

      {/* Suppliers List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                {(hasPermission('suppliers.update') || hasPermission('suppliers.delete')) && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="4" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                      <p className="mt-4 text-gray-500 text-sm">Buscando proveedores...</p>
                    </div>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500">
                    <Building className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    No se encontraron proveedores
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                          {supplier.tax_id && (
                            <div className="text-xs text-gray-500">RIF: {supplier.tax_id}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {supplier.contacts && supplier.contacts.length > 0 ? (
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center">
                            <User className="h-4 w-4 text-gray-400 mr-2" />
                            {supplier.contacts.find(c => c.is_primary)?.name || supplier.contacts[0].name}
                          </div>
                          {supplier.contacts.length > 1 && (
                            <span className="text-xs text-gray-500">
                              +{supplier.contacts.length - 1} más
                            </span>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {(() => {
                              const primaryContact = supplier.contacts.find(c => c.is_primary) || supplier.contacts[0];
                              if (primaryContact.email || primaryContact.phone) {
                                return [
                                  primaryContact.email && <div key="email" className="flex items-center">
                                    <Mail className="h-3 w-3 mr-1" />
                                    {primaryContact.email}
                                  </div>,
                                  primaryContact.phone && <div key="phone" className="flex items-center">
                                    <Phone className="h-3 w-3 mr-1" />
                                    {primaryContact.phone}
                                  </div>
                                ];
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Sin contactos</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${supplier.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {supplier.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {(hasPermission('suppliers.update') || hasPermission('suppliers.delete')) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleView(supplier)}
                          className="text-gray-600 hover:text-gray-900 mr-3"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {hasPermission('suppliers.update') && supplier.is_active && (
                          <button
                            onClick={() => handleEdit(supplier)}
                            className="text-primary-600 hover:text-primary-900 mr-3"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {hasPermission('suppliers.delete') && supplier.is_active && (
                          <button
                            onClick={() => handleDelete(supplier.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Página <span className="font-medium">{currentPage}</span> de{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <span className="sr-only">Anterior</span>
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <span className="sr-only">Siguiente</span>
                    »
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={handleCloseModal}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Building className="h-6 w-6" />
                    {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="bg-white px-6 py-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Nombre del Proveedor *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="input"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        RIF / Tax ID
                      </label>
                      <input
                        type="text"
                        name="tax_id"
                        value={formData.tax_id}
                        onChange={handleChange}
                        placeholder="Ej: J-123456789"
                        className="input"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Condiciones de Pago
                      </label>
                      <input
                        type="text"
                        name="payment_terms"
                        value={formData.payment_terms}
                        onChange={handleChange}
                        placeholder="Ej: 30 días, Contado"
                        className="input"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Contactos del Proveedor
                      </label>
                      <SupplierContactManager
                        contacts={formData.contacts}
                        onChange={(contacts) => setFormData(prev => ({ ...prev, contacts }))}
                        readonly={false}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Notas
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows={3}
                        className="input"
                      />
                    </div>

                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingSupplier ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingSupplier && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowViewModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Building className="h-6 w-6" />
                    Detalles del Proveedor
                  </h3>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="bg-white px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - Image and Basic Info */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Status Supplier */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <label className="block text-sm font-medium text-gray-500 mb-2">Estado</label>
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${viewingSupplier.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {viewingSupplier.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Creado
                        </label>
                        <p className="text-sm text-gray-900">
                          {(() => {
                            const date = viewingSupplier.createdAt || viewingSupplier.created_at;
                            if (!date) return '-';
                            try {
                              return new Date(date).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              });
                            } catch (e) {
                              return '-';
                            }
                          })()}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Actualizado
                        </label>
                        <p className="text-sm text-gray-900">
                          {(() => {
                            const date = viewingSupplier.updatedAt || viewingSupplier.updated_at;
                            if (!date) return '-';
                            try {
                              return new Date(date).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              });
                            } catch (e) {
                              return '-';
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Details */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Información Básica
                      </h4>
                      <div className="grid gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500">Nombre</label>
                          <p className="mt-1 text-sm text-gray-900">{viewingSupplier.name}</p>
                        </div>

                        {viewingSupplier.tax_id && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500">RIF / Tax ID</label>
                            <p className="mt-1 text-sm text-gray-900">{viewingSupplier.tax_id}</p>
                          </div>
                        )}

                        {viewingSupplier.payment_terms && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500">Condiciones de Pago</label>
                            <p className="mt-1 text-sm text-gray-900">{viewingSupplier.payment_terms}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contactos */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Contact className="h-4 w-4" />
                        Contactos
                      </h4>
                      {viewingSupplier.contacts && viewingSupplier.contacts.length > 0 ? (
                        <div className="space-y-3">
                          {viewingSupplier.contacts.map((contact) => (
                            <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-3">
                              {contact.is_primary && (
                                <div className="flex items-center mb-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Contacto Principal
                                  </span>
                                </div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div>
                                  <div className="flex items-center">
                                    <User className="h-4 w-4 text-gray-400 mr-2" />
                                    <p className="font-medium text-gray-900">{contact.name}</p>
                                  </div>
                                  {contact.position && (
                                    <div className="flex items-center ml-6">
                                      <span className="text-gray-500">{contact.position}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-gray-600 space-y-1">
                                  {contact.email && (
                                    <div className="flex items-center">
                                      <Mail className="h-3 w-3 mr-2" />
                                      {contact.email}
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center">
                                      <Phone className="h-3 w-3 mr-2" />
                                      {contact.phone}
                                    </div>
                                  )}
                                  {contact.mobile && (
                                    <div className="flex items-center">
                                      <Phone className="h-3 w-3 mr-2" />
                                      Móvil: {contact.mobile}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Sin contactos registrados</p>
                      )}
                    </div>

                    {/* Notas */}
                    {viewingSupplier.notes && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <BookText className="h-4 w-4" />
                          Información Adicional
                        </h4>
                        <div className="grid gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-500">Notas</label>
                            <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{viewingSupplier.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        onClick={() => setShowViewModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cerrar
                      </button>
                      {hasPermission('suppliers.update') && viewingSupplier.is_active && (
                        <button
                          onClick={() => {
                            setShowViewModal(false);
                            handleEdit(viewingSupplier);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
};

export default SuppliersPage;
