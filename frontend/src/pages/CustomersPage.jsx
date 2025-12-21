import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

const CustomersPage = () => {
  const { token, hasPermission } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const statusLabels = {
    active: { text: 'Activo', class: 'bg-green-100 text-green-800' },
    inactive: { text: 'Inactivo', class: 'bg-gray-100 text-gray-800' },
    blocked: { text: 'Bloqueado', class: 'bg-red-100 text-red-800' },
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, typeFilter, statusFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      // TODO: Implement customer API endpoint
      // For now, show empty state
      setCustomers([]);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (customer) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const columns = [
    { header: 'Código', accessor: 'code' },
    {
      header: 'Nombre/Razón Social',
      accessor: (row) => row.type === 'juridical'
        ? (row.businessName || row.tradeName)
        : `${row.firstName} ${row.lastName}`,
    },
    {
      header: 'Tipo',
      accessor: (row) => row.type === 'natural' ? 'Natural' : 'Jurídica',
    },
    {
      header: 'Documento',
      accessor: (row) => `${row.documentType} ${row.documentNumber}`,
    },
    {
      header: 'Email',
      accessor: 'email',
    },
    {
      header: 'Teléfono',
      accessor: (row) => row.phone || row.mobile || '-',
    },
    {
      header: 'Estado',
      accessor: (row) => {
        const status = statusLabels[row.status] || statusLabels.active;
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.class}`}>
            {status.text}
          </span>
        );
      },
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleView(row)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Ver detalles"
          >
            <Eye className="h-4 w-4" />
          </button>
          {hasPermission('sales.view') && (
            <button
              onClick={() => {/* TODO: Navigate to edit */}}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
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
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600 mt-1">Gestiona la información de tus clientes</p>
        </div>
        {hasPermission('sales.view') && (
          <button
            onClick={() => {/* TODO: Navigate to create */}}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Nuevo Cliente
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input"
          >
            <option value="">Todos los tipos</option>
            <option value="natural">Persona Natural</option>
            <option value="juridical">Persona Jurídica</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={customers}
          loading={loading}
          emptyMessage="No se encontraron clientes. Crea tu primer cliente usando el botón 'Nuevo Cliente'."
        />
      </div>

      {/* View Modal */}
      {showModal && selectedCustomer && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedCustomer(null);
          }}
          title={`Cliente ${selectedCustomer.code}`}
          size="large"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <p className="mt-1 text-gray-900">
                  {selectedCustomer.type === 'natural' ? 'Persona Natural' : 'Persona Jurídica'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Estado</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusLabels[selectedCustomer.status].class}`}>
                    {statusLabels[selectedCustomer.status].text}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Documento</label>
                <p className="mt-1 text-gray-900">
                  {selectedCustomer.documentType} {selectedCustomer.documentNumber}
                </p>
              </div>
              {selectedCustomer.type === 'natural' ? (
                <div>
                  <label className="text-sm font-medium text-gray-700">Nombre Completo</label>
                  <p className="mt-1 text-gray-900">
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Razón Social</label>
                    <p className="mt-1 text-gray-900">{selectedCustomer.businessName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nombre Comercial</label>
                    <p className="mt-1 text-gray-900">{selectedCustomer.tradeName || '-'}</p>
                  </div>
                </>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{selectedCustomer.email || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Teléfono</label>
                <p className="mt-1 text-gray-900">{selectedCustomer.phone || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Móvil</label>
                <p className="mt-1 text-gray-900">{selectedCustomer.mobile || '-'}</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Dirección</label>
                <p className="mt-1 text-gray-900">{selectedCustomer.address || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Límite de Crédito</label>
                <p className="mt-1 text-gray-900">
                  S/ {parseFloat(selectedCustomer.creditLimit || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Días de Crédito</label>
                <p className="mt-1 text-gray-900">{selectedCustomer.creditDays || 0} días</p>
              </div>
            </div>

            {selectedCustomer.notes && (
              <div>
                <label className="text-sm font-medium text-gray-700">Notas</label>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{selectedCustomer.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CustomersPage;
