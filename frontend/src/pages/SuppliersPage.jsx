import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { toast } from 'sonner';
import {
  Plus, Building, User, Envelope, Phone,
  Calendar, Clock, Tag, AddressBook, NotePencil,
} from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { supplierService } from '../services/api/supplierService';
import SupplierContactManager from '../components/suppliers/SupplierContactManager';
import SupplierStatementModal from '../components/suppliers/SupplierStatementModal';
import SupplierViewSheet from '../components/suppliers/SupplierViewSheet';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Input, Modal,
  Pagination, SearchInput, Table, Textarea, useTableLimit,
  ViewAction, StatementAction, EditAction, DeleteAction,
} from '../components/ui';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const emptyForm = () => ({
  name: '', tax_id: '', payment_terms: '', notes: '', is_active: true, contacts: [],
});

const SuppliersPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useTableLimit();

  // ─── Filtros y paginación ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [statementSupplier, setStatementSupplier] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(emptyForm());

  // ─── Sort (server-side) ───────────────────────────────────────────────────────
  const { sortBy: supSortBy, sortDir: supSortDir, onSort: _supOnSort } = useTableSort([], { serverSide: true, defaultField: 'name', defaultDir: 'asc' });
  const supOnSort = (f, d) => { _supOnSort(f, d); setCurrentPage(1); };

  // ─── Query ───────────────────────────────────────────────────────────────────
  const {
    data: suppliersData = {},
    isLoading,
    isError: fetchError,
  } = useQuery({
    queryKey: ['suppliers', currentPage, search, limit, supSortBy, supSortDir],
    queryFn: () => supplierService.getAll({ page: currentPage, limit, search: search || undefined, sort_by: supSortBy, sort_dir: supSortDir }),
    staleTime: 30_000,
  });

  const suppliers  = suppliersData?.data || [];
  const totalPages = suppliersData?.pagination?.totalPages || 1;
  const total      = suppliersData?.pagination?.total || 0;

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['suppliers'] });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editingSupplier
        ? supplierService.update(editingSupplier.id, data)
        : supplierService.create(data),
    onSuccess: () => {
      toast.success(editingSupplier ? 'Proveedor actualizado exitosamente' : 'Proveedor creado exitosamente');
      handleCloseModal();
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar el proveedor'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => supplierService.delete(id),
    onSuccess: () => {
      toast.success('Proveedor eliminado exitosamente');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al eliminar el proveedor');
      setDeleteTarget(null);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setFormData(emptyForm());
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name:          supplier.name || '',
      tax_id:        supplier.tax_id || '',
      payment_terms: supplier.payment_terms || '',
      notes:         supplier.notes || '',
      is_active:     supplier.is_active !== undefined ? supplier.is_active : true,
      contacts:      supplier.contacts || [],
    });
    setViewingSupplier(null);
    setShowModal(true);
  };

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // ─── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'supplier',
      header: 'Proveedor',
      sortable: true,
      sortKey: 'name',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <Building className="h-5 w-5 text-gray-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">{row.name}</p>
            {row.tax_id && <p className="text-xs text-gray-500">RIF: {row.tax_id}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contacto',
      render: (_, row) => {
        if (!row.contacts?.length)
          return <span className="text-sm text-gray-400">Sin contactos</span>;
        const primary = row.contacts.find((c) => c.is_primary) || row.contacts[0];
        return (
          <div className="text-sm space-y-0.5">
            <div className="flex items-center gap-1.5 font-medium text-gray-900">
              <User className="h-3.5 w-3.5 text-gray-400" />
              {primary.name}
              {row.contacts.length > 1 && (
                <span className="text-xs text-gray-400">+{row.contacts.length - 1}</span>
              )}
            </div>
            {primary.email && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Envelope className="h-3 w-3" /> {primary.email}
              </div>
            )}
            {primary.phone && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Phone className="h-3 w-3" /> {primary.phone}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      sortKey: 'is_active',
      render: (_, row) => (
        <Badge variant={row.is_active ? 'success' : 'error'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_, row) => (
        <div className="flex gap-1">
          <ViewAction onClick={() => setViewingSupplier(row)} />
          <StatementAction onClick={() => setStatementSupplier(row)} />
          {hasPermission('suppliers.update') && row.is_active && (
            <EditAction onClick={() => handleEdit(row)} />
          )}
          {hasPermission('suppliers.delete') && row.is_active && (
            <DeleteAction onClick={() => setDeleteTarget(row)} />
          )}
        </div>
      ),
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* ── Cabecera ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proveedores</h1>
          <p className="text-gray-500 mt-1">Gestión de proveedores</p>
        </div>
        {hasPermission('suppliers.create') && (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> Nuevo Proveedor
          </Button>
        )}
      </div>

      {/* ── Error de carga ────────────────────────────────────────────────────── */}
      {fetchError && (
        <Alert variant="error" className="mb-4" dismissible>
          Error al cargar los proveedores. Intenta de nuevo.
        </Alert>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="mb-6">
        <SearchInput
          value={search}
          onChange={(value) => { setSearch(value); setCurrentPage(1); }}
          placeholder="Buscar proveedores..."
        />
      </Card>

      {/* ── Tabla ─────────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={suppliers}
          loading={isLoading}
          emptyMessage="No se encontraron proveedores"
          sortBy={supSortBy}
          sortDir={supSortDir}
          onSort={supOnSort}
        />
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setCurrentPage}
          onLimitChange={(l) => { setLimit(l); setCurrentPage(1); }}
        />
      </Card>

      {/* ── Modal crear / editar ──────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal} disabled={saveMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" form="supplier-form" loading={saveMutation.isPending}>
              {editingSupplier ? 'Actualizar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
          <Input label="Nombre del Proveedor *" name="name" value={formData.name} onChange={set('name')} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="RIF / Tax ID" name="tax_id" value={formData.tax_id} onChange={set('tax_id')} placeholder="Ej: J-123456789" />
            <Input label="Condiciones de Pago" name="payment_terms" value={formData.payment_terms} onChange={set('payment_terms')} placeholder="Ej: 30 días, Contado" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contactos del Proveedor</label>
            <SupplierContactManager
              contacts={formData.contacts}
              onChange={(contacts) => setFormData((prev) => ({ ...prev, contacts }))}
              readonly={false}
            />
          </div>
          <Textarea label="Notas" name="notes" value={formData.notes} onChange={set('notes')} rows={3} />
        </form>
      </Modal>

      {/* ── Sheet ver detalle ─────────────────────────────────────────────────── */}
      <SupplierViewSheet
        open={!!viewingSupplier}
        onClose={() => setViewingSupplier(null)}
        supplier={viewingSupplier}
        onEdit={() => { handleEdit(viewingSupplier); setViewingSupplier(null); }}
        hasPermission={hasPermission}
      />

      {/* ── Estado de cuenta ──────────────────────────────────────────────────── */}
      {statementSupplier && (
        <SupplierStatementModal
          supplier={statementSupplier}
          onClose={() => setStatementSupplier(null)}
        />
      )}

      {/* ── Confirmar eliminación ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        variant="danger"
        title="¿Eliminar este proveedor?"
        description={deleteTarget ? `"${deleteTarget.name}" será eliminado permanentemente.` : ''}
        confirmLabel="Eliminar"
      />
    </div>
  );
};

export default SuppliersPage;
