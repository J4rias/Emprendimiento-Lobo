import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTableSort } from '../hooks/useTableSort';
import { Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/api/userService';
import {
  Alert, Badge, Button, Card, ConfirmDialog, Input, Modal, SearchInput, Select, Table,
  EditAction, ToggleLockAction, type Column,
} from '../components/ui';
import { formatDateShort } from '../utils/formatUtils';

interface UserRow {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role_id: string | number;
  is_active: boolean;
  role?: { id: number; name: string };
  last_login?: string;
  [key: string]: unknown;
}

interface RoleRow {
  id: number;
  name: string;
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role_id: string;
  is_active: boolean;
}

const emptyForm = (): UserFormData => ({
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  role_id: '',
  is_active: true,
});

const UsersPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // ─── Filtros ─────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [toggleTarget, setToggleTarget] = useState<UserRow | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm());

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const {
    data: usersData,
    isLoading,
    isError: fetchError,
  } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: () => userService.getAll({
      ...(search    && { search }),
      ...(roleFilter && { roleId: roleFilter }),
    }),
    staleTime: 30_000,
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userService.getRoles(),
    staleTime: Infinity,
  });

  const usersRaw: UserRow[] = usersData?.data || [];
  const roles: RoleRow[] = rolesData?.data?.roles || [];

  const { sortBy: userSortBy, sortDir: userSortDir, onSort: userOnSort, sortedData: users } = useTableSort(usersRaw);

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (editingUser) return userService.update(editingUser.id, data);
      return userService.create(data);
    },
    onSuccess: () => {
      toast.success(editingUser ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente');
      handleCloseModal();
      invalidateUsers();
    },
    onError: (err: unknown) => {
      toast.error((err as any)?.response?.data?.message || 'Error al guardar el usuario');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (user: UserRow) => userService.update(user.id, { is_active: !user.is_active }),
    onSuccess: (_: unknown, user: UserRow) => {
      toast.success(user.is_active ? 'Usuario desactivado' : 'Usuario activado');
      invalidateUsers();
    },
    onError: (err: unknown) => {
      toast.error((err as any)?.response?.data?.message || 'Error al actualizar el usuario');
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData(emptyForm());
  };

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    setFormData({
      username:   user.username,
      email:      user.email,
      password:   '',
      first_name: user.first_name,
      last_name:  user.last_name,
      phone:      user.phone || '',
      role_id:    String(user.role_id),
      is_active:  user.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...formData };
    if (editingUser && !formData.password) delete payload.password;
    saveMutation.mutate(payload);
  };

  const set = (field: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // ─── Table columns ───────────────────────────────────────────────────────────
  const columns: Column<UserRow>[] = [
    { key: 'username', header: 'Usuario', sortable: true, sortKey: 'username', render: (v: unknown) => String(v) },
    { key: 'name', header: 'Nombre', sortable: true, sortKey: 'first_name', render: (_: unknown, r: UserRow) => `${r.first_name} ${r.last_name}` },
    { key: 'email',     header: 'Email',    render: (v: unknown) => String(v) },
    { key: 'phone',     header: 'Teléfono', render: (_: unknown, r: UserRow) => r.phone || '—' },
    { key: 'role',      header: 'Rol',      render: (_: unknown, r: UserRow) => r.role?.name || '—' },
    {
      key: 'status',
      header: 'Estado',
      render: (_: unknown, r: UserRow) => (
        <Badge variant={r.is_active ? 'success' : 'neutral'}>
          {r.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'last_login',
      header: 'Último acceso',
      sortable: true,
      sortKey: 'last_login',
      render: (_: unknown, r: UserRow) =>
        r.last_login
          ? formatDateShort(r.last_login)
          : 'Nunca',
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'w-px',
      render: (_: unknown, r: UserRow) => (
        <div className="flex gap-1">
          {hasPermission('users.update') && (
            <>
              <EditAction onClick={() => handleEdit(r)} />
              <ToggleLockAction active={r.is_active} onClick={() => setToggleTarget(r)} />
            </>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Cabecera ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-gray-500 mt-1">Gestiona los usuarios del sistema</p>
        </div>
        {hasPermission('users.create') && (
          <Button onClick={() => { setFormData(emptyForm()); setEditingUser(null); setShowModal(true); }}>
            <Plus className="h-4 w-4" /> Nuevo Usuario
          </Button>
        )}
      </div>

      {/* ── Error de carga ────────────────────────────────────────────────────── */}
      {fetchError && (
        <Alert variant="error" className="mb-4" dismissible>
          Error al cargar los usuarios. Intenta de nuevo.
        </Alert>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <Card variant="flat" >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre, usuario, email..."
            />
          </div>
          <div className="w-52">
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">Todos los roles</option>
              {roles.map((role: RoleRow) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* ── Tabla ─────────────────────────────────────────────────────────────── */}
      <Card variant="flat" className="overflow-hidden">
        <Table
          columns={columns}
          data={users}
          loading={isLoading}
          emptyMessage="No se encontraron usuarios"
          sortBy={userSortBy}
          sortDir={userSortDir}
          onSort={userOnSort}
        />
      </Card>

      {/* ── Modal crear / editar ──────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" form="user-form" loading={saveMutation.isPending}>
              {editingUser ? 'Actualizar' : 'Crear'} Usuario
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Usuario *"
              value={formData.username}
              onChange={set('username')}
              required
              disabled={!!editingUser}
            />
            <Input
              label="Email *"
              type="email"
              value={formData.email}
              onChange={set('email')}
              required
            />
            <Input
              label="Nombre *"
              value={formData.first_name}
              onChange={set('first_name')}
              required
            />
            <Input
              label="Apellido *"
              value={formData.last_name}
              onChange={set('last_name')}
              required
            />
            <Input
              label="Teléfono"
              value={formData.phone}
              onChange={set('phone')}
            />
            <Select
              label="Rol *"
              value={formData.role_id}
              onChange={set('role_id')}
              required
            >
              <option value="">Seleccione un rol</option>
              {roles.map((role: RoleRow) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </Select>
            <div className="col-span-2">
              <Input
                label={editingUser ? 'Contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'}
                type="password"
                value={formData.password}
                onChange={set('password')}
                required={!editingUser}
                placeholder={editingUser ? 'Dejar en blanco para no cambiar' : ''}
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Usuario activo</span>
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Confirmar cambio de estado ────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => { if (toggleTarget) toggleMutation.mutate(toggleTarget); setToggleTarget(null); }}
        loading={toggleMutation.isPending}
        title={`${toggleTarget?.is_active ? 'Desactivar' : 'Activar'} usuario`}
        description={`${toggleTarget?.first_name} ${toggleTarget?.last_name} ${toggleTarget?.is_active ? 'perderá acceso al sistema.' : 'recuperará acceso al sistema.'}`}
        confirmLabel={toggleTarget?.is_active ? 'Desactivar' : 'Activar'}
        variant="warning"
      />
    </div>
  );
};

export default UsersPage;
