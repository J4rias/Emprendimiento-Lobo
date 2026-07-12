import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { Plus, Shield, CheckSquare, Square, Buildings, Printer, Users, Lock } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { toast } from 'sonner';
import api from '../services/api/axios';
import { userService } from '../services/api/userService';
import { arService } from '../services/api/arService';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Input, Modal, SearchInput, Select, Table, Textarea,
  EditAction, DeleteAction, ToggleLockAction,
} from '../components/ui';

// ── Constants ─────────────────────────────────────────────────────────────────
const MODULE_NAMES = {
  inventory: 'Inventario', sales: 'Ventas', categories: 'Categorías',
  brands: 'Marcas', price_lists: 'Listas de Precios', customers: 'Clientes',
  suppliers: 'Proveedores', warehouses: 'Almacenes', users: 'Usuarios',
  roles: 'Roles', reports: 'Reportes', company: 'Empresa', purchases: 'Compras',
  products: 'Productos', stock: 'Stock', credit_notes: 'Notas de Crédito',
  supplier_payments: 'Pagos a Proveedores', settings: 'Configuraciones',
};

const BLANK_ROLE = { name: '', description: '', is_active: true, permissions: [] };
const BLANK_USER = {
  username: '', email: '', password: '',
  first_name: '', last_name: '', phone: '',
  role_id: '', is_active: true,
};

// ── Tab button ────────────────────────────────────────────────────────────────
const TabBtn = ({ active, onClick, icon: Icon, children }) => (
  <button
    onClick={onClick}
    className={`py-4 px-1 border-b-2 font-medium text-sm ${active
      ? 'border-primary-500 text-primary-600'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    <Icon className="inline-block h-5 w-5 mr-2" />
    {children}
  </button>
);

const SettingsPage = () => {
  const { hasPermission } = useAuth();
  const { companySettings, reloadCompany } = useCompany();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('roles');

  // ── Role state ────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);
  const [formData, setFormData] = useState(BLANK_ROLE);

  // ── User state ─────────────────────────────────────────────────────────────────
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [toggleUserTarget, setToggleUserTarget] = useState(null);
  const [userFormData, setUserFormData] = useState(BLANK_USER);

  // ── Company state ─────────────────────────────────────────────────────────────
  const [companyForm, setCompanyForm] = useState({
    name: '', address: '', phone: '', email: '', tax_id: '', website: '',
  });

  // ── Printer state ──────────────────────────────────────────────────────────────
  const [printerSettings, setPrinterSettings] = useState({ width: '72mm', margin: '0mm', zoom: '1.0' });
  const [portablePrinterSettings, setPortablePrinterSettings] = useState({ width: '72mm', fontSize: '13px' });

  // ── PIN state ──────────────────────────────────────────────────────────────────
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // ── Effects ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (companySettings) {
      setCompanyForm({
        name: companySettings.name || '',
        address: companySettings.address || '',
        phone: companySettings.phone || '',
        email: companySettings.email || '',
        tax_id: companySettings.tax_id || '',
        website: companySettings.website || '',
      });
    }
  }, [companySettings]);

  useEffect(() => {
    const saved = localStorage.getItem('pos_printer_settings');
    if (saved) setPrinterSettings(JSON.parse(saved));
    const savedPortable = localStorage.getItem('pos_printer_portable_settings');
    if (savedPortable) setPortablePrinterSettings(JSON.parse(savedPortable));
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────────────
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then(r => r.data),
  });
  const rolesRaw = rolesData?.data?.roles || [];

  const { data: permsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get('/roles/permissions').then(r => r.data),
  });
  const permissions = permsData?.data?.permissions || [];

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', userSearch, userRoleFilter],
    queryFn: () => userService.getAll({
      ...(userSearch     && { search: userSearch }),
      ...(userRoleFilter && { roleId: userRoleFilter }),
    }),
  });
  const usersRaw = usersData?.data || [];

  const { sortBy: roleSortBy, sortDir: roleSortDir, onSort: roleOnSort, sortedData: roles } = useTableSort(rolesRaw);
  const { sortBy: settingsUserSortBy, sortDir: settingsUserSortDir, onSort: settingsUserOnSort, sortedData: users } = useTableSort(usersRaw);

  // ── Mutations ──────────────────────────────────────────────────────────────────
  const roleSaveMutation = useMutation({
    mutationFn: ({ id, payload }) => id
      ? api.put(`/roles/${id}`, payload).then(r => r.data)
      : api.post('/roles', payload).then(r => r.data),
    onSuccess: (_, { id }) => {
      toast.success(id ? 'Rol actualizado' : 'Rol creado');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar el rol'),
  });

  const roleDeleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      setDeleteRoleTarget(null);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar el rol'),
  });

  const userSaveMutation = useMutation({
    mutationFn: ({ id, payload }) => id
      ? userService.update(id, payload)
      : userService.create(payload),
    onSuccess: (_, { id }) => {
      toast.success(id ? 'Usuario actualizado' : 'Usuario creado');
      setShowUserModal(false);
      resetUserForm();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar el usuario'),
  });

  const toggleUserMutation = useMutation({
    mutationFn: (user) => userService.update(user.id, { is_active: !user.is_active }),
    onSuccess: (_, user) => {
      toast.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'}`);
      setToggleUserTarget(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar el usuario'),
  });

  const companyMutation = useMutation({
    mutationFn: (data) => api.put('/company', data),
    onSuccess: () => {
      toast.success('Datos de empresa actualizados');
      reloadCompany();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar los datos de empresa'),
  });

  const pinMutation = useMutation({
    mutationFn: (p) => arService.setAdminPin(p),
    onSuccess: () => {
      toast.success('PIN configurado exitosamente');
      setPin('');
      setConfirmPin('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar el PIN'),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────────
  const setCompany  = (f) => (e) => setCompanyForm(p => ({ ...p, [f]: e.target.value }));
  const setUserFld  = (f) => (e) => setUserFormData(p => ({ ...p, [f]: e.target.value }));
  const setPrinter  = (f) => (e) => setPrinterSettings(p => ({ ...p, [f]: e.target.value }));
  const setPortable = (f) => (e) => setPortablePrinterSettings(p => ({ ...p, [f]: e.target.value }));

  const resetForm = () => { setEditingRole(null); setFormData(BLANK_ROLE); };
  const resetUserForm = () => { setEditingUser(null); setUserFormData(BLANK_USER); };

  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      is_active: role.is_active,
      permissions: role.permissions?.map(p => p.id) || [],
    });
    setShowModal(true);
  };

  const handleUserEdit = (user) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username, email: user.email, password: '',
      first_name: user.first_name, last_name: user.last_name,
      phone: user.phone || '', role_id: user.role_id, is_active: user.is_active,
    });
    setShowUserModal(true);
  };

  const togglePermission = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const toggleModulePermissions = (module) => {
    const modulePerms = permissions.filter(p => p.module === module).map(p => p.id);
    const allSelected = modulePerms.every(id => formData.permissions.includes(id));
    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(id => !modulePerms.includes(id))
        : [...new Set([...prev.permissions, ...modulePerms])],
    }));
  };

  const handleRoleSubmit = (e) => {
    e.preventDefault();
    roleSaveMutation.mutate({ id: editingRole?.id, payload: formData });
  };

  const handleUserSubmit = (e) => {
    e.preventDefault();
    const payload = { ...userFormData };
    if (editingUser && !payload.password) delete payload.password;
    userSaveMutation.mutate({ id: editingUser?.id, payload });
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) return toast.error('El PIN debe ser de 4 a 6 dígitos numéricos');
    if (pin !== confirmPin) return toast.error('Los PINs no coinciden');
    pinMutation.mutate(pin);
  };

  // ── Table columns ──────────────────────────────────────────────────────────────
  const roleColumns = [
    { key: 'name', header: 'Nombre', sortable: true, sortKey: 'name', render: (v) => v },
    { key: 'description', header: 'Descripción', render: (v) => v },
    { key: 'permissions', header: 'Permisos',    render: (_, row) => row.permissions?.length || 0 },
    {
      key: 'is_active',
      header: 'Estado',
      render: (v) => <Badge variant={v ? 'success' : 'neutral'}>{v ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_, row) => (
        <div className="flex gap-1">
          {hasPermission('roles.manage') && (
            <>
              <EditAction onClick={() => handleEdit(row)} />
              <DeleteAction onClick={() => setDeleteRoleTarget(row.id)} />
            </>
          )}
        </div>
      ),
    },
  ];

  const userColumns = [
    { key: 'username', header: 'Usuario', sortable: true, sortKey: 'username', render: (v) => v },
    { key: 'first_name', header: 'Nombre', sortable: true, sortKey: 'first_name', render: (_, row) => `${row.first_name} ${row.last_name}` },
    { key: 'email',      header: 'Email',   render: (v) => v },
    { key: 'role',       header: 'Rol',     sortable: true, sortKey: 'role.name', render: (_, row) => row.role?.name || '-' },
    {
      key: 'is_active',
      header: 'Estado',
      render: (v) => <Badge variant={v ? 'success' : 'neutral'}>{v ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_, row) => (
        <div className="flex gap-1">
          {hasPermission('users.update') && (
            <>
              <EditAction onClick={() => handleUserEdit(row)} />
              <ToggleLockAction active={row.is_active} onClick={() => setToggleUserTarget(row)} />
            </>
          )}
        </div>
      ),
    },
  ];

  const permissionsByModule = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-600 mt-1">Gestiona roles, permisos y configuraciones del sistema</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {hasPermission('settings.manage') && (
            <TabBtn active={activeTab === 'empresa'} onClick={() => setActiveTab('empresa')} icon={Buildings}>
              Empresa
            </TabBtn>
          )}
          <TabBtn active={activeTab === 'roles'} onClick={() => setActiveTab('roles')} icon={Shield}>
            Roles y Permisos
          </TabBtn>
          <TabBtn active={activeTab === 'impresora'} onClick={() => setActiveTab('impresora')} icon={Printer}>
            Impresora (POS)
          </TabBtn>
          {hasPermission('users.view') && (
            <TabBtn active={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')} icon={Users}>
              Usuarios
            </TabBtn>
          )}
          {hasPermission('settings.manage') && (
            <TabBtn active={activeTab === 'seguridad'} onClick={() => setActiveTab('seguridad')} icon={Lock}>
              Seguridad
            </TabBtn>
          )}
        </nav>
      </div>

      {/* ── Roles tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {hasPermission('roles.manage') && (
            <div className="flex justify-end">
              <Button onClick={() => { resetForm(); setShowModal(true); }}>
                <Plus className="h-4 w-4" /> Nuevo Rol
              </Button>
            </div>
          )}
          <Card variant="flat" className="overflow-hidden">
            <Table
              columns={roleColumns}
              data={roles}
              loading={rolesLoading}
              emptyMessage="No se encontraron roles"
              sortBy={roleSortBy}
              sortDir={roleSortDir}
              onSort={roleOnSort}
            />
          </Card>
        </div>
      )}

      {/* ── Usuarios tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'usuarios' && hasPermission('users.view') && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={userSearch}
                onChange={(v) => setUserSearch(v)}
                placeholder="Buscar usuarios..."
              />
            </div>
            <div className="w-48">
              <Select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)}>
                <option value="">Todos los roles</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
            {hasPermission('users.create') && (
              <Button onClick={() => { resetUserForm(); setShowUserModal(true); }}>
                <Plus className="h-4 w-4" /> Nuevo Usuario
              </Button>
            )}
          </div>
          <Card variant="flat" className="overflow-hidden">
            <Table
              columns={userColumns}
              data={users}
              loading={usersLoading}
              emptyMessage="No se encontraron usuarios"
              sortBy={settingsUserSortBy}
              sortDir={settingsUserSortDir}
              onSort={settingsUserOnSort}
            />
          </Card>
        </div>
      )}

      {/* ── Empresa tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'empresa' && hasPermission('settings.manage') && (
        <Card className="max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos de la Empresa</h2>
          <form onSubmit={(e) => { e.preventDefault(); companyMutation.mutate(companyForm); }} className="space-y-4">
            <Input
              label="Nombre de la empresa *"
              value={companyForm.name}
              onChange={setCompany('name')}
              required
            />
            <Input
              label="Dirección"
              value={companyForm.address}
              onChange={setCompany('address')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Teléfono"
                value={companyForm.phone}
                onChange={setCompany('phone')}
              />
              <Input
                label="Correo electrónico"
                type="email"
                value={companyForm.email}
                onChange={setCompany('email')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="RIF / NIT / Tax ID"
                value={companyForm.tax_id}
                onChange={setCompany('tax_id')}
              />
              <Input
                label="Sitio web"
                value={companyForm.website}
                onChange={setCompany('website')}
              />
            </div>
            <div className="pt-4 border-t">
              <Button type="submit" loading={companyMutation.isPending}>
                Guardar Cambios Empresa
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Impresora tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'impresora' && (
        <div className="space-y-6 max-w-2xl">
          {/* Desktop */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Desktop — DIG E200L</h2>
            <p className="text-sm text-gray-500 mb-6">
              Impresora conectada por USB a la PC. Usa el diálogo de impresión del navegador.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem('pos_printer_settings', JSON.stringify(printerSettings));
              toast.success('Configuración de impresora desktop guardada');
            }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Select label="Ancho de Papel" value={printerSettings.width} onChange={setPrinter('width')}>
                  <option value="72mm">72mm (área imprimible real)</option>
                  <option value="80mm">80mm (ancho total)</option>
                  <option value="58mm">58mm (pequeñas)</option>
                </Select>
                <Select label="Zoom" value={printerSettings.zoom} onChange={setPrinter('zoom')}>
                  <option value="0.8">0.8</option>
                  <option value="0.9">0.9</option>
                  <option value="1.0">1.0</option>
                  <option value="1.1">1.1</option>
                  <option value="1.2">1.2</option>
                </Select>
                <Select label="Margen" value={printerSettings.margin} onChange={setPrinter('margin')}>
                  <option value="0mm">0mm</option>
                  <option value="1mm">1mm</option>
                  <option value="2mm">2mm</option>
                  <option value="3mm">3mm</option>
                  <option value="5mm">5mm</option>
                </Select>
              </div>
              <Button type="submit">Guardar Desktop</Button>
            </form>
          </Card>

          {/* Portable */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Portátil — GOOJPRT MP-3 (Bluetooth)</h2>
            <p className="text-sm text-gray-500 mb-6">
              Impresora Bluetooth 80mm. Imprime vía RawBT enviando imagen del ticket.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem('pos_printer_portable_settings', JSON.stringify(portablePrinterSettings));
              toast.success('Configuración de impresora portátil guardada');
            }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select label="Ancho de Papel" value={portablePrinterSettings.width} onChange={setPortable('width')}>
                  <option value="72mm">72mm (área imprimible 80mm)</option>
                  <option value="80mm">80mm (ancho total)</option>
                  <option value="58mm">58mm</option>
                </Select>
                <Select label="Tamaño de Fuente" value={portablePrinterSettings.fontSize} onChange={setPortable('fontSize')}>
                  <option value="11px">11px (Compacto)</option>
                  <option value="12px">12px (Pequeño)</option>
                  <option value="13px">13px (Normal)</option>
                  <option value="14px">14px (Grande)</option>
                  <option value="15px">15px (Extra Grande)</option>
                </Select>
              </div>
              <Alert variant="warning">
                La app <strong>RawBT</strong> debe estar instalada y configurada con la impresora Bluetooth emparejada.
              </Alert>
              <Button type="submit">Guardar Portátil</Button>
            </form>
          </Card>
        </div>
      )}

      {/* ── Seguridad tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'seguridad' && hasPermission('settings.manage') && (
        <Card className="max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Configurar PIN de Crédito</h2>
          <p className="text-sm text-gray-500 mb-6">
            Este PIN se usará para autorizar reversiones de abonos en el módulo de Cuentas por Cobrar.
          </p>
          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Nuevo PIN (4-6 dígitos)"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="1234"
                maxLength="6"
              />
              <Input
                label="Confirmar PIN"
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="1234"
                maxLength="6"
              />
            </div>
            <Button type="submit" loading={pinMutation.isPending}>
              Guardar PIN
            </Button>
          </form>
        </Card>
      )}

      {/* ── Role modal ────────────────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title={editingRole ? 'Editar Rol' : 'Nuevo Rol'}
        size="xl"
      >
        <form onSubmit={handleRoleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <Input
                label="Nombre del Rol *"
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Administrador, Cajero..."
                required
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Descripción"
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={1}
                placeholder="Describe las funciones de este rol..."
              />
            </div>
            <div className="md:col-span-1">
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-md transition-colors">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                  className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-semibold text-gray-700">Estado Activo</span>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Permisos del Sistema</h3>
              <span className="text-xs text-gray-400">Pulsa el cuadro junto al título para marcar todo el bloque</span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">
                {Object.entries(permissionsByModule).map(([module, perms]) => {
                  const allSelected = perms.every(p => formData.permissions.includes(p.id));
                  return (
                    <div key={module} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="bg-gray-50/50 border-b border-gray-100 p-4 flex items-center gap-3 rounded-t-xl">
                        <button
                          type="button"
                          onClick={() => toggleModulePermissions(module)}
                          className="p-1 hover:bg-white rounded-md transition-colors shadow-sm bg-white"
                          title="Seleccionar todos"
                        >
                          {allSelected
                            ? <CheckSquare className="h-5 w-5 text-primary-600" />
                            : <Square className="h-5 w-5 text-gray-300" />}
                        </button>
                        <h4 className="font-bold text-gray-900 capitalize text-sm flex-1">
                          Módulo: {MODULE_NAMES[module] || module}
                        </h4>
                        <span className="text-[10px] bg-white border border-gray-100 px-2 py-0.5 rounded-full text-gray-400 uppercase tracking-tighter">
                          {perms.length} perms
                        </span>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                        {perms.map(permission => (
                          <label
                            key={permission.id}
                            className="flex items-start gap-3 text-sm cursor-pointer group hover:bg-blue-50/50 p-1.5 rounded transition-all"
                          >
                            <div className="pt-0.5">
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </div>
                            <span className="text-gray-700 group-hover:text-blue-700 leading-tight">
                              {permission.description}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" loading={roleSaveMutation.isPending}>
              {editingRole ? 'Actualizar' : 'Crear'} Rol
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── User modal ────────────────────────────────────────────────────────── */}
      <Modal
        open={showUserModal}
        onClose={() => { setShowUserModal(false); resetUserForm(); }}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        size="md"
      >
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Usuario *"
              value={userFormData.username}
              onChange={setUserFld('username')}
              required
              disabled={!!editingUser}
            />
            <Input
              label="Email *"
              type="email"
              value={userFormData.email}
              onChange={setUserFld('email')}
              required
            />
            <Input
              label="Nombre *"
              value={userFormData.first_name}
              onChange={setUserFld('first_name')}
              required
            />
            <Input
              label="Apellido *"
              value={userFormData.last_name}
              onChange={setUserFld('last_name')}
              required
            />
            <Select
              label="Rol *"
              value={userFormData.role_id}
              onChange={setUserFld('role_id')}
              required
            >
              <option value="">Seleccione rol</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
            <Input
              label="Teléfono"
              value={userFormData.phone}
              onChange={setUserFld('phone')}
            />
            <div className="col-span-2">
              <Input
                label={`Contraseña${editingUser ? ' (dejar vacío para no cambiar)' : ' *'}`}
                type="password"
                value={userFormData.password}
                onChange={setUserFld('password')}
                required={!editingUser}
                placeholder={editingUser ? '••••••••' : 'Contraseña'}
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userFormData.is_active}
                  onChange={(e) => setUserFormData(p => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Usuario Activo</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => { setShowUserModal(false); resetUserForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" loading={userSaveMutation.isPending}>
              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Confirm dialogs ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteRoleTarget}
        onClose={() => setDeleteRoleTarget(null)}
        onConfirm={() => roleDeleteMutation.mutate(deleteRoleTarget)}
        loading={roleDeleteMutation.isPending}
        title="Eliminar rol"
        description="Esta acción no se puede deshacer. Los usuarios asignados a este rol perderán sus permisos."
        confirmLabel="Eliminar"
        variant="danger"
      />

      <ConfirmDialog
        open={!!toggleUserTarget}
        onClose={() => setToggleUserTarget(null)}
        onConfirm={() => toggleUserMutation.mutate(toggleUserTarget)}
        loading={toggleUserMutation.isPending}
        title={`${toggleUserTarget?.is_active ? 'Desactivar' : 'Activar'} usuario`}
        description={toggleUserTarget ? `${toggleUserTarget.first_name} ${toggleUserTarget.last_name}` : ''}
        confirmLabel={toggleUserTarget?.is_active ? 'Desactivar' : 'Activar'}
        variant="warning"
      />
    </div>
  );
};

export default SettingsPage;
