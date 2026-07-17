import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { Plus, Shield, CheckSquare, Square, Buildings, Printer, Users, Lock } from '@phosphor-icons/react';
import type { Icon as IconType } from '@phosphor-icons/react';
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
import type { BadgeVariant, Column } from '../components/ui';

// ── Local Interfaces ──────────────────────────────────────────────────────────
interface Permission {
  id: number;
  name: string;
  description?: string;
  module: string;
}

interface Role {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  permissions?: Permission[];
  [key: string]: unknown;
}

interface RolePayload {
  name: string;
  description: string;
  is_active: boolean;
  permissions: number[];
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role_id: string;
  is_active: boolean;
  role?: { name: string };
  [key: string]: unknown;
}

interface UserPayload {
  username: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  phone: string;
  role_id: string;
  is_active: boolean;
}

interface CompanyForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
  website: string;
}

interface PrinterSettings {
  width: string;
  margin: string;
  zoom: string;
}

interface PortablePrinterSettings {
  width: string;
  fontSize: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MODULE_NAMES: Record<string, string> = {
  inventory: 'Inventario', sales: 'Ventas', categories: 'Categorías',
  brands: 'Marcas', price_lists: 'Listas de Precios', customers: 'Clientes',
  suppliers: 'Proveedores', warehouses: 'Almacenes', users: 'Usuarios',
  roles: 'Roles', reports: 'Reportes', company: 'Empresa', purchases: 'Compras',
  products: 'Productos', stock: 'Stock', credit_notes: 'Notas de Crédito',
  supplier_payments: 'Pagos a Proveedores', settings: 'Configuraciones',
};

const BLANK_ROLE: RolePayload = { name: '', description: '', is_active: true, permissions: [] };
const BLANK_USER: UserPayload = {
  username: '', email: '', password: '',
  first_name: '', last_name: '', phone: '',
  role_id: '', is_active: true,
};

// ── Tab button ────────────────────────────────────────────────────────────────
interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: IconType;
  children: React.ReactNode;
}

const TabBtn = ({ active, onClick, icon: Icon, children }: TabBtnProps) => (
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
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<number | null>(null);
  const [formData, setFormData] = useState<RolePayload>(BLANK_ROLE);

  // ── User state ─────────────────────────────────────────────────────────────────
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [toggleUserTarget, setToggleUserTarget] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<UserPayload>(BLANK_USER);

  // ── Company state ─────────────────────────────────────────────────────────────
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: '', address: '', phone: '', email: '', tax_id: '', website: '',
  });

  // ── Printer state ──────────────────────────────────────────────────────────────
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({ width: '72mm', margin: '0mm', zoom: '1.0' });
  const [portablePrinterSettings, setPortablePrinterSettings] = useState<PortablePrinterSettings>({ width: '72mm', fontSize: '13px' });

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
  const rolesRaw: Role[] = rolesData?.data?.roles || [];

  const { data: permsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get('/roles/permissions').then(r => r.data),
  });
  const permissions: Permission[] = permsData?.data?.permissions || [];

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', userSearch, userRoleFilter],
    queryFn: () => userService.getAll({
      ...(userSearch     && { search: userSearch }),
      ...(userRoleFilter && { roleId: userRoleFilter }),
    }),
  });
  const usersRaw: User[] = usersData?.data || [];

  const { sortBy: roleSortBy, sortDir: roleSortDir, onSort: roleOnSort, sortedData: roles } = useTableSort<Role>(rolesRaw);
  const { sortBy: settingsUserSortBy, sortDir: settingsUserSortDir, onSort: settingsUserOnSort, sortedData: users } = useTableSort<User>(usersRaw);

  // ── Mutations ──────────────────────────────────────────────────────────────────
  const roleSaveMutation = useMutation({
    mutationFn: (vars: { id?: number; payload: RolePayload }) => vars.id
      ? api.put(`/roles/${vars.id}`, vars.payload).then(r => r.data)
      : api.post('/roles', vars.payload).then(r => r.data),
    onSuccess: (_, vars) => {
      toast.success(vars.id ? 'Rol actualizado' : 'Rol creado');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Error al guardar el rol');
    },
  });

  const roleDeleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      setDeleteRoleTarget(null);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Error al eliminar el rol');
    },
  });

  const userSaveMutation = useMutation({
    mutationFn: (vars: { id?: number; payload: UserPayload }) => vars.id
      ? userService.update(vars.id, vars.payload as unknown as Record<string, unknown>)
      : userService.create(vars.payload as unknown as Record<string, unknown>),
    onSuccess: (_, vars) => {
      toast.success(vars.id ? 'Usuario actualizado' : 'Usuario creado');
      setShowUserModal(false);
      resetUserForm();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Error al guardar el usuario');
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: (user: User) => userService.update(user.id, { is_active: !user.is_active }),
    onSuccess: (_, user: User) => {
      toast.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'}`);
      setToggleUserTarget(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Error al actualizar el usuario');
    },
  });

  const companyMutation = useMutation({
    mutationFn: (data: CompanyForm) => api.put('/company', data),
    onSuccess: () => {
      toast.success('Datos de empresa actualizados');
      reloadCompany();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Error al guardar los datos de empresa');
    },
  });

  const pinMutation = useMutation({
    mutationFn: (p: string) => arService.setAdminPin(p),
    onSuccess: () => {
      toast.success('PIN configurado exitosamente');
      setPin('');
      setConfirmPin('');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Error al guardar el PIN');
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────────
  const setCompany  = (f: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm(p => ({ ...p, [f]: e.target.value }));
  const setUserFld  = (f: keyof UserPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setUserFormData(p => ({ ...p, [f]: e.target.value }));
  const setPrinter  = (f: keyof PrinterSettings) => (e: React.ChangeEvent<HTMLSelectElement>) => setPrinterSettings(p => ({ ...p, [f]: e.target.value }));
  const setPortable = (f: keyof PortablePrinterSettings) => (e: React.ChangeEvent<HTMLSelectElement>) => setPortablePrinterSettings(p => ({ ...p, [f]: e.target.value }));

  const resetForm = () => { setEditingRole(null); setFormData(BLANK_ROLE); };
  const resetUserForm = () => { setEditingUser(null); setUserFormData(BLANK_USER); };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      is_active: role.is_active,
      permissions: role.permissions?.map((p: Permission) => p.id) || [],
    });
    setShowModal(true);
  };

  const handleUserEdit = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username, email: user.email, password: '',
      first_name: user.first_name, last_name: user.last_name,
      phone: user.phone || '', role_id: user.role_id, is_active: user.is_active,
    });
    setShowUserModal(true);
  };

  // Dependency map: permission X requires permission Y to be active
  const PERM_DEPENDENCIES: Record<string, string> = {
    'sales.credit': 'sales.collect',
  };

  const togglePermission = (permissionId: number) => {
    const perm = permissions.find((p: Permission) => p.id === permissionId);
    setFormData(prev => {
      const isRemoving = prev.permissions.includes(permissionId);
      let next = isRemoving
        ? prev.permissions.filter((id: number) => id !== permissionId)
        : [...prev.permissions, permissionId];

      // If removing a permission, also remove any that depend on it
      if (isRemoving && perm) {
        const dependents = Object.entries(PERM_DEPENDENCIES)
          .filter(([, dep]) => dep === perm.name)
          .map(([name]) => permissions.find((p: Permission) => p.name === name)?.id)
          .filter(Boolean) as number[];
        next = next.filter((id: number) => !dependents.includes(id));
      }

      return { ...prev, permissions: next };
    });
  };

  const toggleModulePermissions = (moduleKey: string) => {
    const modulePerms = permissions.filter((p: Permission) => p.module === moduleKey).map((p: Permission) => p.id);
    const allSelected = modulePerms.every((id: number) => formData.permissions.includes(id));
    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((id: number) => !modulePerms.includes(id))
        : [...new Set([...prev.permissions, ...modulePerms])],
    }));
  };

  const handleRoleSubmit = () => {
    roleSaveMutation.mutate({ id: editingRole?.id, payload: formData });
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...userFormData };
    if (editingUser && !payload.password) delete payload.password;
    userSaveMutation.mutate({ id: editingUser?.id, payload });
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) return toast.error('El PIN debe ser de 4 a 6 dígitos numéricos');
    if (pin !== confirmPin) return toast.error('Los PINs no coinciden');
    pinMutation.mutate(pin);
  };

  // ── Table columns ──────────────────────────────────────────────────────────────
  const roleColumns: Column<Role>[] = [
    { key: 'name', header: 'Nombre', sortable: true, sortKey: 'name', render: (v: unknown) => String(v ?? '') },
    { key: 'description', header: 'Descripción', render: (v: unknown) => String(v ?? '') },
    { key: 'permissions', header: 'Permisos',    render: (_: unknown, row: Role) => row.permissions?.length || 0 },
    {
      key: 'is_active',
      header: 'Estado',
      render: (v: unknown) => <Badge variant={(v ? 'success' : 'neutral') as BadgeVariant}>{v ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_: unknown, row: Role) => (
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

  const userColumns: Column<User>[] = [
    { key: 'username', header: 'Usuario', sortable: true, sortKey: 'username', render: (v: unknown) => String(v ?? '') },
    { key: 'first_name', header: 'Nombre', sortable: true, sortKey: 'first_name', render: (_: unknown, row: User) => `${row.first_name} ${row.last_name}` },
    { key: 'email',      header: 'Email',   render: (v: unknown) => String(v ?? '') },
    { key: 'role',       header: 'Rol',     sortable: true, sortKey: 'role.name', render: (_: unknown, row: User) => row.role?.name || '-' },
    {
      key: 'is_active',
      header: 'Estado',
      render: (v: unknown) => <Badge variant={(v ? 'success' : 'neutral') as BadgeVariant}>{v ? 'Activo' : 'Inactivo'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_: unknown, row: User) => (
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

  const permissionsByModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
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
                onChange={(v: string) => setUserSearch(v)}
                placeholder="Buscar usuarios..."
              />
            </div>
            <div className="w-48">
              <Select value={userRoleFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUserRoleFilter(e.target.value)}>
                <option value="">Todos los roles</option>
                {roles.map((r: Role) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
          <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); companyMutation.mutate(companyForm); }} className="space-y-4">
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
            <form onSubmit={(e: React.FormEvent) => {
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
            <form onSubmit={(e: React.FormEvent) => {
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPin(e.target.value)}
                placeholder="1234"
                maxLength={6}
              />
              <Input
                label="Confirmar PIN"
                type="password"
                value={confirmPin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPin(e.target.value)}
                placeholder="1234"
                maxLength={6}
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
        size="full"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleRoleSubmit} loading={roleSaveMutation.isPending}>
              {editingRole ? 'Actualizar' : 'Crear'} Rol
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <Input
                label="Nombre del Rol *"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Administrador, Cajero..."
                required
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Descripción"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={1}
                placeholder="Describe las funciones de este rol..."
              />
            </div>
            <div className="md:col-span-1">
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-md transition-colors">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
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

            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">
                {Object.entries(permissionsByModule).map(([moduleKey, perms]: [string, Permission[]]) => {
                  const allSelected = perms.every((p: Permission) => formData.permissions.includes(p.id));
                  return (
                    <div key={moduleKey} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="bg-gray-50/50 border-b border-gray-100 p-4 flex items-center gap-3 rounded-t-xl">
                        <button
                          type="button"
                          onClick={() => toggleModulePermissions(moduleKey)}
                          className="p-1 hover:bg-white rounded-md transition-colors shadow-sm bg-white"
                          title="Seleccionar todos"
                        >
                          {allSelected
                            ? <CheckSquare className="h-5 w-5 text-primary-600" />
                            : <Square className="h-5 w-5 text-gray-300" />}
                        </button>
                        <h4 className="font-bold text-gray-900 capitalize text-sm flex-1">
                          Módulo: {MODULE_NAMES[moduleKey] || moduleKey}
                        </h4>
                        <span className="text-[10px] bg-white border border-gray-100 px-2 py-0.5 rounded-full text-gray-400 uppercase tracking-tighter">
                          {perms.length} perms
                        </span>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                        {perms.map((permission: Permission) => {
                          const depName = PERM_DEPENDENCIES[permission.name];
                          const depMissing = depName && !formData.permissions.includes(
                            permissions.find((p: Permission) => p.name === depName)?.id ?? -1
                          );
                          return (
                          <label
                            key={permission.id}
                            className={`flex items-start gap-3 text-sm p-1.5 rounded transition-all ${depMissing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group hover:bg-primary-50/50'}`}
                            title={depMissing ? `Requiere "${permissions.find((p: Permission) => p.name === depName)?.description}"` : undefined}
                          >
                            <div className="pt-0.5">
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                disabled={!!depMissing}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                              />
                            </div>
                            <span className="text-gray-700 group-hover:text-primary-700 leading-tight">
                              {permission.description}
                              {depMissing && <span className="text-[10px] text-gray-400 ml-1">(requiere Cobrar ventas)</span>}
                            </span>
                          </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
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
              {roles.map((r: Role) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
                value={userFormData.password || ''}
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserFormData(p => ({ ...p, is_active: e.target.checked }))}
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
        onConfirm={() => {
          if (deleteRoleTarget !== null) roleDeleteMutation.mutate(deleteRoleTarget);
        }}
        loading={roleDeleteMutation.isPending}
        title="Eliminar rol"
        description="Esta acción no se puede deshacer. Los usuarios asignados a este rol perderán sus permisos."
        confirmLabel="Eliminar"
        variant="danger"
      />

      <ConfirmDialog
        open={!!toggleUserTarget}
        onClose={() => setToggleUserTarget(null)}
        onConfirm={() => {
          if (toggleUserTarget) toggleUserMutation.mutate(toggleUserTarget);
        }}
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
