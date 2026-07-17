import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import api from '../services/api/axios';
import { Plus, Buildings, Globe } from '@phosphor-icons/react';
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
  ViewAction, EditAction, DeleteAction,
} from '../components/ui';
import BrandViewSheet from '../components/brands/BrandViewSheet';
import { formatDateShort } from '../utils/formatUtils';

interface BrandRow {
  id: number;
  name: string;
  description?: string;
  logo_url?: string;
  website?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  [key: string]: unknown;
}

const BrandsPage = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);
  const [viewingBrand, setViewingBrand] = useState<BrandRow | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useTableLimit();
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    website: '',
    notes: '',
    is_active: true
  });

  // ─── Sort (server-side) ───────────────────────────────────────────────────────
  const { sortBy: brandSortBy, sortDir: brandSortDir, onSort: _brandOnSort } = useTableSort([], { serverSide: true, defaultField: 'name', defaultDir: 'asc' });
  const brandOnSort = (f: string, d: 'asc' | 'desc') => { _brandOnSort(f, d); setCurrentPage(1); };

  const { data: brandsData, isLoading, error: fetchError } = useQuery({
    queryKey: ['brands', currentPage, searchTerm, limit, brandSortBy, brandSortDir],
    queryFn: () => api.get('/brands', { params: { page: currentPage, limit, search: searchTerm, sort_by: brandSortBy, sort_dir: brandSortDir } }).then(r => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const brands     = brandsData?.data || [];
  const totalPages = brandsData?.pagination?.totalPages || 1;
  const total      = brandsData?.pagination?.total || 0;
  const loading    = isLoading;
  const error      = fetchError?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSend: Record<string, unknown> = { ...formData };
      if (!formData.website || formData.website.trim() === '') delete dataToSend.website;
      if (!formData.logo_url || formData.logo_url.trim() === '') delete dataToSend.logo_url;

      if (editingBrand) {
        await api.put(`/brands/${editingBrand.id}`, dataToSend);
      } else {
        await api.post('/brands', dataToSend);
      }
      toast.success(editingBrand ? 'Marca actualizada' : 'Marca creada');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      handleCloseModal();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar la marca');
    }
  };

  const handleView = (brand: BrandRow) => {
    setViewingBrand(brand);
    setShowViewModal(true);
  };

  const handleEdit = (brand: BrandRow) => {
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

  const handleDelete = (id: number) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/brands/${deleteTargetId}`);
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al eliminar la marca');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBrand(null);
    setFormData({ name: '', description: '', logo_url: '', website: '', notes: '', is_active: true });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const formatDate = (date: string) => formatDateShort(date);

  const columns = [
    {
      header: 'Marca',
      sortable: true,
      sortKey: 'name',
      render: (_: unknown, brand: BrandRow) => (
        <div className="flex items-center">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="max-h-10 w-10 mr-3 object-cover" />
          ) : (
            <Buildings className="h-10 w-10 text-gray-400 mr-3" />
          )}
          <div className="text-sm font-medium text-gray-900">{brand.name}</div>
        </div>
      ),
    },
    {
      header: 'Descripción',
      wrap: true,
      render: (_: unknown, brand: BrandRow) => (
        <div className="text-sm text-gray-900 max-w-xs truncate">{brand.description || '-'}</div>
      ),
    },
    {
      header: 'Sitio Web',
      render: (_: unknown, brand: BrandRow) => brand.website ? (
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
      sortable: true,
      sortKey: 'is_active',
      render: (_: unknown, brand: BrandRow) => (
        <Badge variant={brand.is_active ? 'success' : 'error'}>
          {brand.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      header: 'Acciones',
      className: 'text-right',
      render: (_: unknown, brand: BrandRow) => (
        <div className="flex items-center justify-end gap-1">
          <ViewAction onClick={() => handleView(brand)} />
          <EditAction onClick={() => handleEdit(brand)} />
          {brand.is_active && (
            <DeleteAction onClick={() => handleDelete(brand.id)} />
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
          emptyIcon={Buildings}
          emptyMessage="No se encontraron marcas"
          emptyDescription={searchTerm ? 'Intenta con otra búsqueda' : 'Crea tu primera marca'}
          emptyAction={!searchTerm ? (
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4" />
              Nueva Marca
            </Button>
          ) : undefined}
          sortBy={brandSortBy}
          sortDir={brandSortDir}
          onSort={brandOnSort}
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
              onChange={(url) => setFormData(prev => ({ ...prev, logo_url: typeof url === 'string' ? url : url[0] || '' }))}
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

      {/* View Sheet */}
      <BrandViewSheet
        open={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingBrand(null); }}
        brand={viewingBrand}
        onEdit={() => { setShowViewModal(false); handleEdit(viewingBrand); }}
      />

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
