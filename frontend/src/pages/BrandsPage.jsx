import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api/axios';
import { Plus, Edit2, Trash2, Building2, Globe, Eye } from 'lucide-react';
import ImageUpload from '../components/common/ImageUpload';
import {
  Button,
  Badge,
  Alert,
  Card,
  EmptyState,
  ConfirmDialog,
  Modal,
  Pagination,
  SearchInput,
  Table,
  useTableLimit,
} from '../components/ui';

const BrandsPage = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [viewingBrand, setViewingBrand] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useTableLimit();
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    website: '',
    notes: '',
    is_active: true
  });

  const { data: brandsData, isLoading, error: fetchError } = useQuery({
    queryKey: ['brands', currentPage, searchTerm, limit],
    queryFn: () => api.get('/brands', { params: { page: currentPage, limit, search: searchTerm } }).then(r => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const brands = brandsData?.data || [];
  const totalPages = brandsData?.pagination?.totalPages || 1;
  const total = brandsData?.pagination?.total || 0;
  const loading = isLoading;
  const error = fetchError?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.website || dataToSend.website.trim() === '') delete dataToSend.website;
      if (!dataToSend.logo_url || dataToSend.logo_url.trim() === '') delete dataToSend.logo_url;

      if (editingBrand) {
        await api.put(`/brands/${editingBrand.id}`, dataToSend);
      } else {
        await api.post('/brands', dataToSend);
      }
      toast.success(editingBrand ? 'Marca actualizada' : 'Marca creada');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      handleCloseModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar la marca');
    }
  };

  const handleView = (brand) => {
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

  const handleDelete = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/brands/${deleteTargetId}`);
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al eliminar la marca');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBrand(null);
    setFormData({ name: '', description: '', logo_url: '', website: '', notes: '', is_active: true });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const formatDate = (date) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const columns = [
    {
      header: 'Marca',
      render: (_, brand) => (
        <div className="flex items-center">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="max-h-10 w-10 mr-3 object-cover" />
          ) : (
            <Building2 className="h-10 w-10 text-gray-400 mr-3" />
          )}
          <div className="text-sm font-medium text-gray-900">{brand.name}</div>
        </div>
      ),
    },
    {
      header: 'Descripción',
      wrap: true,
      render: (_, brand) => (
        <div className="text-sm text-gray-900 max-w-xs truncate">{brand.description || '-'}</div>
      ),
    },
    {
      header: 'Sitio Web',
      render: (_, brand) => brand.website ? (
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
      ),
    },
    {
      header: 'Estado',
      render: (_, brand) => (
        <Badge variant={brand.is_active ? 'success' : 'error'}>
          {brand.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      header: 'Acciones',
      className: 'text-right',
      render: (_, brand) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => handleView(brand)} title="Ver detalles">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(brand)} title="Editar">
            <Edit2 className="h-4 w-4" />
          </Button>
          {brand.is_active && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDelete(brand.id)}
              title="Eliminar"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marcas</h1>
          <p className="text-gray-600">Gestión de marcas de productos</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Nueva Marca
        </Button>
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
          value={searchTerm}
          onChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
          placeholder="Buscar marcas..."
        />
      </Card>

      {/* Brands Table */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={brands}
          loading={loading}
          emptyIcon={Building2}
          emptyMessage="No se encontraron marcas"
          emptyDescription={searchTerm ? 'Intenta con otra búsqueda' : 'Crea tu primera marca'}
          emptyAction={!searchTerm ? (
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4" />
              Nueva Marca
            </Button>
          ) : undefined}
        />
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setCurrentPage}
          onLimitChange={(newLimit) => { setLimit(newLimit); setCurrentPage(1); }}
        />
      </Card>

      {/* Edit/Create Modal */}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingBrand ? 'Editar Marca' : 'Nueva Marca'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" form="brand-form">
              {editingBrand ? 'Actualizar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="brand-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Marca *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo de la Marca</label>
            <ImageUpload
              value={formData.logo_url}
              onChange={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
              type="brands"
              placeholder="Subir logo de la marca"
              previewSize="h-24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sitio Web</label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://ejemplo.com"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="input" />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Marca Activa</span>
          </label>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        open={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingBrand(null); }}
        title="Detalles de la Marca"
        size="md"
        footer={
          <Button variant="secondary" onClick={() => { setShowViewModal(false); setViewingBrand(null); }}>
            Cerrar
          </Button>
        }
      >
        {viewingBrand && (
          <div className="space-y-4">
            {viewingBrand.logo_url && (
              <div className="flex justify-center">
                <img src={viewingBrand.logo_url} alt={viewingBrand.name} className="h-32 w-32 object-contain" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
              <p className="text-sm text-gray-900">{viewingBrand.name || '-'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Descripción</label>
              <p className="text-sm text-gray-900">{viewingBrand.description || '-'}</p>
            </div>
            {viewingBrand.website && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Sitio Web</label>
                <a
                  href={viewingBrand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-900 flex items-center gap-1"
                >
                  <Globe className="h-4 w-4" />
                  {viewingBrand.website}
                </a>
              </div>
            )}
            {viewingBrand.notes && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notas</label>
                <p className="text-sm text-gray-900">{viewingBrand.notes}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Estado</label>
              <Badge variant={viewingBrand.is_active ? 'success' : 'error'}>
                {viewingBrand.is_active ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Creado</label>
                <p className="text-sm text-gray-900">{formatDate(viewingBrand.createdAt || viewingBrand.created_at)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Actualizado</label>
                <p className="text-sm text-gray-900">{formatDate(viewingBrand.updatedAt || viewingBrand.updated_at)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Eliminar marca"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
};

export default BrandsPage;
