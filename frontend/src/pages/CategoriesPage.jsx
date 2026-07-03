import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, Trash2, Tag, Package } from 'lucide-react';
import { categoryService } from '../services/api/categoryService';
import {
  Button,
  Alert,
  Card,
  EmptyState,
  Skeleton,
  ConfirmDialog,
  Modal,
  Pagination,
  SearchInput,
  useTableLimit,
} from '../components/ui';

const CategoriesPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useTableLimit();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    color: '#6B7280'
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: categoriesData, isLoading, error: fetchError } = useQuery({
    queryKey: ['categories', currentPage, search, limit],
    queryFn: () => categoryService.getAll({ page: currentPage, search: search.trim(), limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const categories = categoriesData?.data || [];
  const totalPages = categoriesData?.pagination?.totalPages || 1;
  const total = categoriesData?.pagination?.total || 0;
  const loading = isLoading;
  const error = fetchError?.message;

  const handleOpenModal = (category = null) => {
    setEditingCategory(category);
    setFormData({
      code: category?.code || '',
      name: category?.name || '',
      description: category?.description || '',
      color: category?.color || '#6B7280'
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ code: '', name: '', description: '', color: '#6B7280' });
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

    try {
      if (editingCategory) {
        await categoryService.update(editingCategory.id, formData);
        toast.success('Categoría actualizada');
      } else {
        await categoryService.create(formData);
        toast.success('Categoría creada');
      }
      handleCloseModal();
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar categoría');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (category) => {
    setDeleteTarget(category);
  };

  const confirmDelete = async () => {
    try {
      await categoryService.delete(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría eliminada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al eliminar categoría');
    } finally {
      setDeleteTarget(null);
    }
  };

  const colorOptions = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
    '#EC4899', '#6B7280', '#84CC16', '#06B6D4', '#F97316',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-600">Gestión de categorías de productos</p>
        </div>
        {hasPermission('products.create') && (
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4" />
            Nueva Categoría
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert key={error} variant="error" title="Error" dismissible>
          {error}
        </Alert>
      )}

      {/* Search */}
      <Card variant="flat">
        <SearchInput
          value={search}
          onChange={(val) => { setSearch(val); setCurrentPage(1); }}
          placeholder="Buscar categorías..."
        />
      </Card>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))
        ) : categories.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Tag}
              title={search ? 'No se encontraron categorías' : 'No hay categorías'}
              description={search ? 'Intenta con otra búsqueda' : 'Crea tu primera categoría para organizar tus productos'}
              action={!search && hasPermission('products.create') ? (
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="h-4 w-4" />
                  Crear Categoría
                </Button>
              ) : undefined}
            />
          </div>
        ) : (
          categories.map((category) => (
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
                    <h3 className="font-semibold text-gray-900 truncate">{category.name}</h3>
                  </div>
                </div>
                {hasPermission('products.create') && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleOpenModal(category)}
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(category)}
                      title="Eliminar"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
          ))
        )}
      </div>

      {/* Pagination */}
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={setCurrentPage}
        onLimitChange={(newLimit) => { setLimit(newLimit); setCurrentPage(1); }}
      />

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
        size="md"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" form="category-form" loading={submitting}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
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
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Eliminar categoría "${deleteTarget?.name}"`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
};

export default CategoriesPage;
