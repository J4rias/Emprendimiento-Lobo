import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api/axios';
import { Plus, Edit2, Trash2, Search, Building2, Globe, MapPin, Eye, X, AlertCircle } from 'lucide-react';
import ImageUpload from '../components/common/ImageUpload';

const BrandsPage = () => {
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [viewingBrand, setViewingBrand] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    website: '',
    notes: '',
    is_active: true
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: brandsData, isLoading, error: fetchError } = useQuery({
    queryKey: ['brands', currentPage, debouncedSearch],
    queryFn: () => api.get('/brands', { params: { page: currentPage, limit: 20, search: debouncedSearch } }).then(r => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const brands = brandsData?.data || [];
  const totalPages = brandsData?.pagination?.totalPages || 1;
  const loading = isLoading;
  const error = fetchError?.message || mutationError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare data, remove empty website field to avoid validation error
      const dataToSend = { ...formData };
      if (!dataToSend.website || dataToSend.website.trim() === '') {
        delete dataToSend.website;
      }
      if (!dataToSend.logo_url || dataToSend.logo_url.trim() === '') {
        delete dataToSend.logo_url;
      }

      if (editingBrand) {
        await api.put(`/brands/${editingBrand.id}`, dataToSend);
      } else {
        await api.post('/brands', dataToSend);
      }
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      handleCloseModal();
    } catch (err) {
      setMutationError('Error al guardar la marca');
      console.error('Error saving brand:', err);
      if (err.response) {
        console.error('Error response:', err.response.data);
      }
    }
  };

  const handleView = (brand) => {
    console.log('Brand data for view:', brand);
    setViewingBrand(brand);
    setShowViewModal(true);
  };

  const handleEdit = (brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name || '',
      description: brand.description || '',
      logo_url: brand.logo_url || '',
      website: brand.website || '',
      notes: brand.notes || '',
      is_active: brand.is_active !== undefined ? brand.is_active : true
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta marca?')) {
      try {
        await api.delete(`/brands/${id}`);
        queryClient.invalidateQueries({ queryKey: ['brands'] });
      } catch (err) {
        setMutationError('Error al eliminar la marca');
        console.error('Error deleting brand:', err);
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBrand(null);
    setFormData({
      name: '',
      description: '',
      logo_url: '',
      website: '',
      notes: '',
      is_active: true
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
          <h1 className="text-2xl font-bold text-gray-900">Marcas</h1>
          <p className="text-gray-600">Gestión de marcas de productos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Nueva Marca
        </button>
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
            onClick={() => setMutationError(null)}
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
            placeholder="Buscar marcas..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="input"
          />
        </div>
      </div>

      {/* Brands List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marca
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sitio Web
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                      <p className="mt-4 text-gray-500 text-sm">Buscando marcas...</p>
                    </div>
                  </td>
                </tr>
              ) : brands.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    No se encontraron marcas
                  </td>
                </tr>
              ) : (
                brands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {brand.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.name}
                            className="max-h-10 w-10 mr-3 object-cover"
                          />
                        ) : (
                          <Building2 className="h-10 w-10 text-gray-400 mr-3" />
                        )}
                        <div className="text-sm font-medium text-gray-900">{brand.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {brand.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {brand.website ? (
                        <a
                          href={brand.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-sm text-primary-600 hover:text-primary-900"
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          {new URL(brand.website).hostname}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${brand.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {brand.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleView(brand)}
                        className="text-gray-600 hover:text-gray-900 mr-3"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(brand)}
                        className="text-primary-600 hover:text-primary-900 mr-3"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {brand.is_active && (
                        <button
                          onClick={() => handleDelete(brand.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
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
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {editingBrand ? 'Editar Marca' : 'Nueva Marca'}
                    </h3>
                  </div>

                  <div className="flex flex-col space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Nombre de la Marca *
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
                        Descripción
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="input"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Logo de la Marca
                      </label>
                      <ImageUpload
                        value={formData.logo_url}
                        onChange={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
                        type="brands"
                        placeholder="Subir logo de la marca"
                        previewSize="h-24"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Sitio Web
                      </label>
                      <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        placeholder="https://ejemplo.com"
                        className="input"
                      />
                    </div>

                    <div className="space-y-2">
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

                    <div className="md:col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleChange}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Marca Activa</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {editingBrand ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista */}
      {showViewModal && viewingBrand && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Detalles de la Marca
                </h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingBrand(null);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Logo */}
                {viewingBrand.logo_url && (
                  <div className="flex justify-center">
                    <img
                      src={viewingBrand.logo_url}
                      alt={viewingBrand.name}
                      className="h-32 w-32 object-contain"
                    />
                  </div>
                )}

                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">Nombre</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingBrand.name || '-'}</p>
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">Descripción</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingBrand.description || '-'}</p>
                </div>

                {/* Sitio Web */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">Sitio Web</label>
                  {viewingBrand.website ? (
                    <a
                      href={viewingBrand.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-sm text-primary-600 hover:text-primary-900 flex items-center"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      {viewingBrand.website}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">-</p>
                  )}
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">Notas</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingBrand.notes || '-'}</p>
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">Estado</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${viewingBrand.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    {viewingBrand.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Creado</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {(() => {
                        const date = viewingBrand.createdAt || viewingBrand.created_at;
                        if (!date) return '-';
                        try {
                          return new Date(date).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          });
                        } catch (e) {
                          return '-';
                        }
                      })()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Actualizado</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {(() => {
                        const date = viewingBrand.updatedAt || viewingBrand.updated_at;
                        if (!date) return '-';
                        try {
                          return new Date(date).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
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

              <div className="mt-6">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingBrand(null);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:w-auto sm:text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandsPage;
