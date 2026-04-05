import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Shield, CheckSquare, Square, Building2, Printer, Users, Lock, Unlock, Search, X } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const { token, hasPermission } = useAuth();
  const { companySettings, reloadCompany } = useCompany();
  const [activeTab, setActiveTab] = useState('roles');
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    permissions: [],
  });

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: '', address: '', phone: '', email: '', tax_id: '', website: '',
  });
  const [companyLoading, setCompanyLoading] = useState(false);
  // Printer settings state
  const [printerSettings, setPrinterSettings] = useState({
    width: '72mm',
    margin: '0mm',
    zoom: '1.0'
  });

  // Users state
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
    is_active: true,
  });
  const [usersLoading, setUsersLoading] = useState(false);

  // PIN state
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const moduleNames = {
    inventory: 'Inventario',
    sales: 'Ventas',
    categories: 'Categorías',
    brands: 'Marcas',
    price_lists: 'Listas de Precios',
    customers: 'Clientes',
    suppliers: 'Proveedores',
    warehouses: 'Almacenes',
    users: 'Usuarios',
    roles: 'Roles',
    reports: 'Reportes',
    company: 'Empresa',
    purchases: 'Compras',
    products: 'Productos',
    stock: 'Stock',
    credit_notes: 'Notas de Crédito',
    supplier_payments: 'Pagos a Proveedores',
    settings: 'Configuraciones'
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoles();
      fetchPermissions();
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, userRoleFilter]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const params = new URLSearchParams({
        ...(userSearch && { search: userSearch }),
        ...(userRoleFilter && { roleId: userRoleFilter }),
      });

      const response = await fetch(`${API_URL}/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setUsers(data.data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingUser
        ? `${API_URL}/users/${editingUser.id}`
        : `${API_URL}/users`;

      const method = editingUser ? 'PUT' : 'POST';

      const payload = { ...userFormData };
      if (editingUser && !payload.password) {
        delete payload.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        setShowUserModal(false);
        resetUserForm();
        fetchUsers();
        toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado');
      } else {
        toast.error(data.message || 'Error al guardar el usuario');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Error al guardar el usuario');
    }
  };

  const handleUserEdit = (user) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      role_id: user.role_id,
      is_active: user.is_active,
    });
    setShowUserModal(true);
  };

  const handleUserToggleActive = async (user) => {
    const action = user.is_active ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Está seguro de ${action} este usuario?`)) return;

    try {
      const response = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      const data = await response.json();
      if (data.success) {
        fetchUsers();
        toast.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'}`);
      } else {
        toast.error(data.message || 'Error al actualizar el usuario');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Error al actualizar el usuario');
    }
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setUserFormData({
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

  const userColumns = [
    { header: 'Usuario', accessor: 'username' },
    {
      header: 'Nombre',
      accessor: (row) => `${row.first_name} ${row.last_name}`,
    },
    { header: 'Email', accessor: 'email' },
    {
      header: 'Rol',
      accessor: (row) => row.role?.name || '-',
    },
    {
      header: 'Estado',
      accessor: (row) => (
        <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${row.is_active
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-800'
          }`}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex gap-2">
          {hasPermission('users.update') && (
            <>
              <button
                onClick={() => handleUserEdit(row)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                title="Editar"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleUserToggleActive(row)}
                className={`p-1 ${row.is_active
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

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setRoles(data.data.roles || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch(`${API_URL}/permissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPermissions(data.data.permissions || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  // Sync company form when context data loads
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

  // Load printer settings
  useEffect(() => {
    const saved = localStorage.getItem('pos_printer_settings');
    if (saved) {
      setPrinterSettings(JSON.parse(saved));
    }
  }, []);

  const handlePrinterSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('pos_printer_settings', JSON.stringify(printerSettings));
    toast.success('Configuración de impresora guardada');
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setCompanyLoading(true);
    try {
      const response = await fetch(`${API_URL}/company`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(companyForm),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Datos de empresa actualizados');
        reloadCompany();
      } else {
        toast.error(data.message || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error('Error al guardar los datos de empresa');
    } finally {
      setCompanyLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingRole
        ? `${API_URL}/roles/${editingRole.id}`
        : `${API_URL}/roles`;

      const method = editingRole ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setShowModal(false);
        resetForm();
        fetchRoles();
      } else {
        alert(data.message || 'Error al guardar el rol');
      }
    } catch (error) {
      console.error('Error saving role:', error);
      alert('Error al guardar el rol');
    }
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      is_active: role.is_active,
      permissions: role.permissions?.map((p) => p.id) || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este rol?')) return;

    try {
      const response = await fetch(`${API_URL}/roles/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        fetchRoles();
      } else {
        alert(data.message || 'Error al eliminar el rol');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Error al eliminar el rol');
    }
  };

  const resetForm = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      is_active: true,
      permissions: [],
    });
  };

  const togglePermission = (permissionId) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((id) => id !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const toggleModulePermissions = (module) => {
    const modulePermissions = permissions
      .filter((p) => p.module === module)
      .map((p) => p.id);

    const allSelected = modulePermissions.every((id) =>
      formData.permissions.includes(id)
    );

    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((id) => !modulePermissions.includes(id)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...modulePermissions])],
      }));
    }
  };

  const roleColumns = [
    { header: 'Nombre', accessor: 'name' },
    { header: 'Descripción', accessor: 'description' },
    {
      header: 'Permisos',
      accessor: (row) => row.permissions?.length || 0,
    },
    {
      header: 'Estado',
      accessor: (row) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${row.is_active
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-800'
          }`}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex gap-2">
          {hasPermission('roles.manage') && (
            <>
              <button
                onClick={() => handleEdit(row)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                title="Editar"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(row.id)}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const permissionsByModule = permissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-600 mt-1">Gestiona roles, permisos y configuraciones del sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {hasPermission('settings.manage') && (
            <button
              onClick={() => setActiveTab('empresa')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'empresa'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Building2 className="inline-block h-5 w-5 mr-2" />
              Empresa
            </button>
          )}
          <button
            onClick={() => setActiveTab('roles')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'roles'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Shield className="inline-block h-5 w-5 mr-2" />
            Roles y Permisos
          </button>
          <button
            onClick={() => setActiveTab('impresora')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'impresora'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Printer className="inline-block h-5 w-5 mr-2" />
            Impresora (POS)
          </button>
          {hasPermission('users.view') && (
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'usuarios'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Users className="inline-block h-5 w-5 mr-2" />
              Usuarios
            </button>
          )}
          {hasPermission('settings.manage') && (
            <button
              onClick={() => setActiveTab('seguridad')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'seguridad'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Lock className="inline-block h-5 w-5 mr-2" />
              Seguridad
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            {hasPermission('roles.manage') && (
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Nuevo Rol
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow">
            <DataTable
              columns={roleColumns}
              data={roles}
              loading={loading}
              emptyMessage="No se encontraron roles"
            />
          </div>
        </div>
      )}

      {/* Usuarios Tab */}
      {activeTab === 'usuarios' && hasPermission('users.view') && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex-1 max-w-lg flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar usuarios..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="input pl-9 w-full"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="input w-48"
              >
                <option value="">Todos los roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            {hasPermission('users.create') && (
              <button
                onClick={() => {
                  resetUserForm();
                  setShowUserModal(true);
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Nuevo Usuario
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow">
            <DataTable
              columns={userColumns}
              data={users}
              loading={usersLoading}
              emptyMessage="No se encontraron usuarios"
            />
          </div>
        </div>
      )}

      {/* Empresa Tab */}
      {activeTab === 'empresa' && hasPermission('settings.manage') && (
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos de la Empresa</h2>
          <form onSubmit={handleCompanySubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la empresa *</label>
              <input
                type="text"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={companyForm.address}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                className="input w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RIF / NIT / Tax ID</label>
                <input
                  type="text"
                  value={companyForm.tax_id}
                  onChange={(e) => setCompanyForm({ ...companyForm, tax_id: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
                <input
                  type="text"
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="pt-4 border-t">
              <button
                type="submit"
                className="btn-primary w-full md:w-auto"
                disabled={companyLoading}
              >
                {companyLoading ? 'Guardando...' : 'Guardar Cambios Empresa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printer Tab */}
      {
        activeTab === 'impresora' && (
          <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración de Ticketera (DIG E200L)</h2>
            <p className="text-sm text-gray-500 mb-6">
              Ajusta estos parámetros para que el ticket se imprima correctamente en tu impresora térmica.
            </p>

            <form onSubmit={handlePrinterSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ancho de Papel</label>
                  <select
                    value={printerSettings.width}
                    onChange={(e) => setPrinterSettings({ ...printerSettings, width: e.target.value })}
                    className="input w-full"
                  >
                    <option value="72mm">72mm (DIG E200L — área imprimible real)</option>
                    <option value="80mm">80mm (Ancho total del papel)</option>
                    <option value="58mm">58mm (Impresoras pequeñas)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400">La DIG E200L usa papel de 80mm.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zoom de Impresión</label>
                  <select
                    value={printerSettings.zoom}
                    onChange={(e) => setPrinterSettings({ ...printerSettings, zoom: e.target.value })}
                    className="input w-full"
                  >
                    <option value="0.8">0.8 (Pequeño)</option>
                    <option value="0.9">0.9 (Medio-Pequeño)</option>
                    <option value="1.0">1.0 (Normal)</option>
                    <option value="1.1">1.1 (Grande)</option>
                    <option value="1.2">1.2 (Extra Grande)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Si el texto sale muy pequeño o grande, ajusta el zoom.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Margen Izquierdo/Derecho</label>
                  <select
                    value={printerSettings.margin}
                    onChange={(e) => setPrinterSettings({ ...printerSettings, margin: e.target.value })}
                    className="input w-full"
                  >
                    <option value="0mm">Sin margen</option>
                    <option value="1mm">1mm</option>
                    <option value="2mm">2mm</option>
                    <option value="3mm">3mm</option>
                    <option value="5mm">5mm</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Si el texto se corta a los lados, agrega un poco de margen.</p>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Printer className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Tip para DIG E200L:</strong> En el diálogo de impresión de Chrome/Edge:
                      <ul className="list-disc ml-5 mt-1">
                        <li>Márgenes: <strong>Ninguno</strong></li>
                        <li>Encabezados y pies de página: <strong>Desactivar</strong></li>
                        <li>Tamaño de papel: <strong>80mm x 297mm</strong> (o similar)</li>
                      </ul>
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="btn-primary w-full md:w-auto">
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        )
      }

      {/* Seguridad Tab - PIN */}
      {activeTab === 'seguridad' && hasPermission('settings.manage') && (
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configurar PIN de Crédito</h2>
          <p className="text-sm text-gray-500 mb-6">
            Este PIN se usará para autorizar reversiones de abonos en el módulo de Cuentas por Cobrar.
          </p>

          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!/^\d{4,6}$/.test(pin)) return toast.error('El PIN debe ser de 4 a 6 dígitos numéricos');
            if (pin !== confirmPin) return toast.error('Los PINs no coinciden');
            try {
              setPinLoading(true);
              const res = await fetch(`${API_URL}/ar/admin-pin`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
              });
              if (res.ok) {
                toast.success('PIN configurado exitosamente');
                setPin('');
                setConfirmPin('');
              } else {
                toast.error((await res.json()).message || 'Error al guardar el PIN');
              }
            } catch (e) {
              toast.error(e.message || 'Error al guardar el PIN');
            } finally {
              setPinLoading(false);
            }
          }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nuevo PIN (4-6 dígitos)</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  className="input w-full"
                  maxLength="6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar PIN</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="1234"
                  className="input w-full"
                  maxLength="6"
                />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={pinLoading} className="btn-primary w-full md:w-auto">
                {pinLoading ? 'Guardando...' : 'Guardar PIN'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create/Edit Role Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            resetForm();
          }}
          title={editingRole ? 'Editar Rol' : 'Nuevo Rol'}
          size="xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre del Rol *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input w-full shadow-sm border-gray-300 focus:ring-primary-500 focus:border-primary-500 rounded-md"
                  placeholder="Ej: Administrador, Cajero..."
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input w-full shadow-sm border-gray-300 focus:ring-primary-500 focus:border-primary-500 rounded-md"
                  rows="1"
                  placeholder="Describe las funciones de este rol..."
                />
              </div>
              <div className="md:col-span-1">
                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-md transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-semibold text-gray-700 font-medium">Estado Activo</span>
                </label>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Permisos del Sistema</h3>
                <span className="text-xs text-gray-400 font-normal">Pulsa el cuadro junto al título para marcar todo el bloque</span>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">
                  {Object.entries(permissionsByModule).map(([module, perms]) => {
                    const allSelected = perms.every((p) =>
                      formData.permissions.includes(p.id)
                    );

                    return (
                      <div key={module} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="bg-gray-50/50 border-b border-gray-100 p-4 flex items-center gap-3 rounded-t-xl">
                          <button
                            type="button"
                            onClick={() => toggleModulePermissions(module)}
                            className="p-1 hover:bg-white rounded-md transition-colors shadow-sm bg-white"
                            title="Seleccionar todos"
                          >
                            {allSelected ? (
                              <CheckSquare className="h-5 w-5 text-primary-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-300" />
                            )}
                          </button>
                          <h4 className="font-bold text-gray-900 capitalize text-sm flex-1">
                            Módulo: {moduleNames[module] || module}
                          </h4>
                          <span className="text-[10px] bg-white border border-gray-100 px-2 py-0.5 rounded-full text-gray-400 uppercase tracking-tighter">
                            {perms.length} perms
                          </span>
                        </div>

                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
                          {perms.map((permission) => (
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
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="btn-secondary px-6"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary px-8">
                {editingRole ? 'Actualizar' : 'Crear'} Rol
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* User Modal */}
      {showUserModal && (
        <Modal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            resetUserForm();
          }}
          title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
          size="md"
        >
          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuario *
                </label>
                <input
                  type="text"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  className="input w-full"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={userFormData.first_name}
                  onChange={(e) => setUserFormData({ ...userFormData, first_name: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido *
                </label>
                <input
                  type="text"
                  value={userFormData.last_name}
                  onChange={(e) => setUserFormData({ ...userFormData, last_name: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol *
                </label>
                <select
                  value={userFormData.role_id}
                  onChange={(e) => setUserFormData({ ...userFormData, role_id: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">Seleccione rol</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={userFormData.phone}
                  onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña {editingUser && '(Dejar vacío para no cambiar)'}
                </label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="input w-full"
                  required={!editingUser}
                  placeholder={editingUser ? '••••••••' : 'Contraseña'}
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userFormData.is_active}
                    onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Usuario Activo</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => { setShowUserModal(false); resetUserForm(); }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default SettingsPage;
