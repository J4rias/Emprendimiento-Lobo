import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Tag,
  X,
  AlertCircle,
  Package
} from 'lucide-react';
import { categoryService } from '../services/api/categoryService';

const CategoriesPage = () => {
  const { token, hasPermission } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    color: '#6B7280'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [currentPage, search]);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await categoryService.getAll({
        page: currentPage,
        search: search.trim()
      });

      setCategories(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category = null) => {
    setEditingCategory(category);
    setFormData({
      code: category?.code || '',
      name: category?.name || '',
      description: category?.description || '',
      color: category?.color || '#6B7280'
    });
    setShowModal(true);
    setError(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      color: '#6B7280'
    });
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'code' ? value.toUpperCase() : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingCategory) {
        await categoryService.update(editingCategory.id, formData);
      } else {
        await categoryService.create(formData);
      }

      handleCloseModal();
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar categoría');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`¿Estás seguro de eliminar la categoría "${category.name}"?`)) {
      return;
    }

    try {
      await categoryService.delete(category.id);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar categoría');
    }
  };

  const colorOptions = [
    '#EF4444', // red
    '#F59E0B', // amber
    '#10B981', // emerald
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#6B7280', // gray
    '#84CC16', // lime
    '#06B6D4', // cyan
    '#F97316', // orange
  ];

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando categorías...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-600">Gestión de categorías de productos</p>
        </div>
        {hasPermission('products.create') && (
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nueva Categoría
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
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar categorías..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map((category) => (
          <div
            key={category.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {category.code}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">
                    {category.name}
                  </h3>
                </div>
              </div>
              {hasPermission('products.create') && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenModal(category)}
                    className="p-1 text-gray-600 hover:text-blue-600"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category)}
                    className="p-1 text-gray-600 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {category.description || 'Sin descripción'}
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Package className="h-4 w-4" />
              <span>{category.productCount || 0} productos</span>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {!loading && categories.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {search ? 'No se encontraron categorías' : 'No hay categorías'}
            </h3>
            <p className="text-gray-500 mb-4">
              {search 
                ? 'Intenta con otra búsqueda'
                : 'Crea tu primera categoría para organizar tus productos'
              }
            </p>
            {!search && hasPermission('products.create') && (
              <button
                onClick={() => handleOpenModal()}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Categoría
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  maxLength="10"
                  className="input uppercase"
                  placeholder="Ej: BEB, LAC, SNK"
                  style={{ textTransform: 'uppercase' }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Código único de la categoría (máx. 10 caracteres)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="Ej: Bebidas, Lácteos, Snacks"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="input"
                  placeholder="Descripción opcional de la categoría..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`h-10 rounded-lg border-2 transition-all ${
                        formData.color === color
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
