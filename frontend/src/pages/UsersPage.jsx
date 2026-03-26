import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Lock, Unlock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/api/userService';

const UsersPage = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
    is_active: true,
  });

  const { data: usersData, isLoading: loading } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: () => userService.getAll({
      ...(search && { search }),
      ...(roleFilter && { roleId: roleFilter }),
    }),
    staleTime: 30_000,
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userService.getRoles(),
    staleTime: Infinity,
  });

  const users = usersData?.data?.users || [];
  const roles = rolesData?.data?.roles || [];

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingUser) {
        return userService.update(editingUser.id, data);
      }
      return userService.create(data);
    },
    onSuccess: () => {
      toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado');
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Error al guardar el usuario');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (user) => userService.update(user.id, { is_active: !user.is_active }),
    onSuccess: () => {
      toast.success('Usuario actualizado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el usuario');
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (editingUser && !payload.password) {
      delete payload.password;
    }
    saveMutation.mutate(payload);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      role_id: user.role_id,
      is_active: user.is_active,
    });
    setShowModal(true);
  };

  const handleToggleActive = async (user) => {
    if (!window.confirm(`¿Está seguro de ${user.is_active ? 'desactivar' : 'activar'} este usuario?`)) return;
    toggleMutation.mutate(user);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      role_id: '',
      is_active: true,
    });
  };

  const columns = [
    { header: 'Usuario', accessor: 'username' },
    {
      header: 'Nombre',
      accessor: (row) => `${row.first_name} ${row.last_name}`,
    },
    { header: 'Email', accessor: 'email' },
    { header: 'Teléfono', accessor: (row) => row.phone || '-' },
    {
      header: 'Rol',
      accessor: (row) => row.role?.name || '-',
    },
    {
      header: 'Estado',
      accessor: (row) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
          row.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      header: 'Último acceso',
      accessor: (row) => row.last_login
        ? new Date(row.last_login).toLocaleDateString('es-PE')
        : 'Nunca',
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex gap-2">
          {hasPermission('users.update') && (
            <>
              <button
                onClick={() => handleEdit(row)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                title="Editar"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleToggleActive(row)}
                className={`p-1 ${
                  row.is_active
                    ? 'text-orange-600 hover:bg-orange-50'
                    : 'text-green-600 hover:bg-green-50'
                } rounded`}
                title={row.is_active ? 'Desactivar' : 'Activar'}
              >
                {row.is_active ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </button>
            </>
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
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600 mt-1">Gestiona los usuarios del sistema</p>
        </div>
        {hasPermission('users.create') && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nuevo Usuario
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, usuario, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input"
          >
            <option value="">Todos los roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          emptyMessage="No se encontraron usuarios"
        />
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            resetForm();
          }}
          title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuario *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="input"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol *
                </label>
                <select
                  value={formData.role_id}
                  onChange={(e) =>
                    setFormData({ ...formData, role_id: e.target.value })
                  }
                  className="input"
                  required
                >
                  <option value="">Seleccione un rol</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña {editingUser && '(dejar en blanco para no cambiar)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="input"
                  required={!editingUser}
                  placeholder={editingUser ? 'Dejar en blanco para no cambiar' : ''}
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Usuario activo</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                {editingUser ? 'Actualizar' : 'Crear'} Usuario
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default UsersPage;
