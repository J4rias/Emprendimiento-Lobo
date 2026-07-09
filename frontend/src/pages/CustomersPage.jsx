import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, User, Phone, MapPin, CurrencyCircleDollar } from '@phosphor-icons/react';
import CustomerStatementModal from '../components/customers/CustomerStatementModal';
import CustomerViewSheet from '../components/customers/CustomerViewSheet';
import { useAuth } from '../context/AuthContext';
import { customerService } from '../services/api/customerService';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Input, Modal, Pagination,
  SearchInput, Select, Table, Textarea, useTableLimit,
  ViewAction, StatementAction, EditAction, DeleteAction,
} from '../components/ui';

// ── Venezuelan document types ────────────────────────────────────────────────
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

const STATUS_VARIANT = { active: 'success', inactive: 'neutral', blocked: 'error' };
const STATUS_LABEL   = { active: 'Activo', inactive: 'Inactivo', blocked: 'Bloqueado' };

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
  const queryClient = useQueryClient();
  const [limit, setLimit] = useTableLimit();

  // ─── Filtros y paginación ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [statementCustomer, setStatementCustomer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(emptyForm());

  // ─── Query ───────────────────────────────────────────────────────────────────
  const {
    data: customersData = {},
    isLoading,
    isError: fetchError,
  } = useQuery({
    queryKey: ['customers', currentPage, search, typeFilter, statusFilter, limit],
    queryFn: () => customerService.getAll({
      page: currentPage,
      limit,
      search: search || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
    staleTime: 30_000,
  });

  const customers  = customersData?.data || [];
  const totalPages = customersData?.pagination?.totalPages || 1;
  const total      = customersData?.pagination?.total || 0;

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customers'] });

  const createMutation = useMutation({
    mutationFn: (data) => customerService.create(data),
    onSuccess: () => {
      toast.success('Cliente creado exitosamente');
      handleCloseModal();
      invalidate();
    },
    onError: (err) => {
      const d = err.response?.data;
      let msg = d?.message || 'Error al crear el cliente';
      if (d?.errors?.length) msg += ': ' + d.errors.map((e) => e.message).join(', ');
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => customerService.update(id, data),
    onSuccess: () => {
      toast.success('Cliente actualizado exitosamente');
      handleCloseModal();
      invalidate();
    },
    onError: (err) => {
      const d = err.response?.data;
      let msg = d?.message || 'Error al actualizar el cliente';
      if (d?.errors?.length) msg += ': ' + d.errors.map((e) => e.message).join(', ');
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => customerService.delete(id),
    onSuccess: () => {
      toast.success('Cliente eliminado exitosamente');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al eliminar el cliente');
      setDeleteTarget(null);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSearchChange = (value) => { setSearch(value); setCurrentPage(1); };
  const handleTypeFilter   = (e) => { setTypeFilter(e.target.value); setCurrentPage(1); };
  const handleStatusFilter = (e) => { setStatusFilter(e.target.value); setCurrentPage(1); };

  const handleView          = (c) => { setViewingCustomer(c); setShowViewModal(true); };
  const handleShowStatement = (c) => setStatementCustomer(c);

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      type:               customer.type || 'natural',
      documentType:       customer.documentType || 'V',
      documentNumber:     customer.documentNumber || '',
      businessName:       customer.businessName || '',
      tradeName:          customer.tradeName || '',
      firstName:          customer.firstName || '',
      lastName:           customer.lastName || '',
      email:              customer.email || '',
      phone:              customer.phone || '',
      mobile:             customer.mobile || '',
      address:            customer.address || '',
      city:               customer.city || '',
      state:              customer.state || '',
      creditLimit:        customer.creditLimit || 0,
      creditDays:         customer.creditDays || 0,
      priceListId:        customer.priceListId || null,
      discountPercentage: customer.discountPercentage || 0,
      notes:              customer.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(emptyForm());
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'type') {
      const validDocs = DOC_TYPES_BY_TYPE[value];
      setFormData((prev) => ({
        ...prev,
        type: value,
        documentType: validDocs.includes(prev.documentType) ? prev.documentType : validDocs[0],
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const availableDocTypes = VE_DOC_TYPES.filter((d) =>
    DOC_TYPES_BY_TYPE[formData.type]?.includes(d.value)
  );

  // ─── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    { key: 'code',     header: 'Código',    render: (v) => v },
    {
      key: 'name',
      header: 'Nombre / Razón Social',
      render: (_, row) =>
        row.type === 'juridical'
          ? row.businessName || row.tradeName
          : `${row.firstName} ${row.lastName}`,
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (_, row) => (row.type === 'natural' ? 'Natural' : 'Jurídica'),
    },
    {
      key: 'document',
      header: 'Documento',
      render: (_, row) => `${row.documentType}-${row.documentNumber}`,
    },
    {
      key: 'phone',
      header: 'Teléfono',
      render: (_, row) => row.phone || row.mobile || '—',
    },
    {
      key: 'status',
      header: 'Estado',
      render: (_, row) => (
        <Badge variant={STATUS_VARIANT[row.status] || 'neutral'}>
          {STATUS_LABEL[row.status] || row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_, row) => (
        <div className="flex gap-1">
          <ViewAction onClick={() => handleView(row)} />
          <StatementAction onClick={() => handleShowStatement(row)} />
          {hasPermission('customers.update') && (
            <EditAction onClick={() => handleEdit(row)} />
          )}
          {hasPermission('customers.delete') && (
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
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-500 mt-1">Gestiona la información de tus clientes</p>
        </div>
        {hasPermission('customers.create') && (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> Nuevo Cliente
          </Button>
        )}
      </div>

      {/* ── Error de carga ────────────────────────────────────────────────────── */}
      {fetchError && (
        <Alert variant="error" className="mb-4" dismissible>
          Error al cargar los clientes. Intenta de nuevo.
        </Alert>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Buscar por nombre, documento..."
            />
          </div>
          <div className="w-52">
            <Select value={typeFilter} onChange={handleTypeFilter}>
              <option value="">Todos los tipos</option>
              <option value="natural">Persona Natural</option>
              <option value="juridical">Persona Jurídica</option>
            </Select>
          </div>
          <div className="w-44">
            <Select value={statusFilter} onChange={handleStatusFilter}>
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="blocked">Bloqueado</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── Tabla ─────────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={customers}
          loading={isLoading}
          emptyMessage="No se encontraron clientes. Crea el primero con 'Nuevo Cliente'."
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
        title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Identificación ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
              <User className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Identificación</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select label="Tipo de Cliente *" name="type" value={formData.type} onChange={handleChange} required>
                <option value="natural">Persona Natural</option>
                <option value="juridical">Persona Jurídica</option>
              </Select>
              <Select
                label="Tipo de Documento *"
                name="documentType"
                value={formData.documentType}
                onChange={handleChange}
                required
                options={availableDocTypes}
              />
            </div>

            {/* Número de documento con prefijo */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Número de Documento <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-700 text-sm font-bold">
                  {formData.documentType}-
                </span>
                <input
                  type="text"
                  name="documentNumber"
                  value={formData.documentNumber}
                  onChange={handleChange}
                  required
                  placeholder={formData.documentType === 'J' ? 'Ej: 12345678-9' : 'Ej: 12345678'}
                  className="flex-1 h-9 px-3 text-sm rounded-r-md border border-gray-300 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-200"
                />
              </div>
            </div>

            {formData.type === 'natural' ? (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nombre *" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="Ej: Juan" />
                <Input label="Apellido *" name="lastName" value={formData.lastName} onChange={handleChange} required placeholder="Ej: Pérez" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Razón Social *" name="businessName" value={formData.businessName} onChange={handleChange} required placeholder="Ej: Mi Empresa C.A." />
                <Input label="Nombre Comercial" name="tradeName" value={formData.tradeName} onChange={handleChange} placeholder="Opcional" />
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
              <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="correo@ejemplo.com" />
              <Input label="Teléfono" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="0212-000-0000" />
              <Input label="Celular" type="tel" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="0414-000-0000" />
            </div>
          </div>

          {/* ── Dirección ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
              <MapPin className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Dirección</h3>
            </div>
            <Input label="Dirección" name="address" value={formData.address} onChange={handleChange} placeholder="Calle, Urbanización, Edificio..." />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Ciudad / Municipio" name="city" value={formData.city} onChange={handleChange} placeholder="Ej: Caracas" />
              <Input label="Estado" name="state" value={formData.state} onChange={handleChange} placeholder="Ej: Miranda" />
            </div>
          </div>

          {/* ── Crédito ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
              <CurrencyCircleDollar className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Información de Crédito</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Límite de Crédito (COP)" type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange} min="0" step="1" />
              <Input label="Días de Crédito" type="number" name="creditDays" value={formData.creditDays} onChange={handleChange} min="0" />
              <Input label="Descuento (%)" type="number" name="discountPercentage" value={formData.discountPercentage} onChange={handleChange} min="0" max="100" step="0.01" />
            </div>
          </div>

          <Textarea label="Notas" name="notes" value={formData.notes} onChange={handleChange} rows={2} placeholder="Observaciones opcionales..." />

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              {editingCustomer ? 'Actualizar Cliente' : 'Crear Cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Sheet ver detalle ─────────────────────────────────────────────────── */}
      <CustomerViewSheet
        open={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingCustomer(null); }}
        customer={viewingCustomer}
        onEdit={() => { setShowViewModal(false); handleEdit(viewingCustomer); }}
        hasPermission={hasPermission}
      />

      {/* ── Estado de cuenta ──────────────────────────────────────────────────── */}
      {statementCustomer && (
        <CustomerStatementModal
          customer={statementCustomer}
          onClose={() => setStatementCustomer(null)}
        />
      )}

      {/* ── Confirmar eliminación ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        loading={deleteMutation.isPending}
        variant="danger"
        title="¿Eliminar este cliente?"
        description={
          deleteTarget
            ? `"${deleteTarget.type === 'natural' ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : deleteTarget.businessName}" será eliminado permanentemente.`
            : ''
        }
        confirmLabel="Eliminar"
      />
    </div>
  );
};

export default CustomersPage;
