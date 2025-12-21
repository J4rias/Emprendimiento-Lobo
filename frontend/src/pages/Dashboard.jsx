import { Package, ShoppingCart, AlertTriangle, DollarSign } from 'lucide-react';

const Dashboard = () => {
  // Datos de ejemplo - en producción vendrían de la API
  const stats = [
    {
      name: 'Productos',
      value: '0',
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      name: 'Ventas del Día',
      value: '$0.00',
      icon: ShoppingCart,
      color: 'bg-green-500',
    },
    {
      name: 'Stock Bajo',
      value: '0',
      icon: AlertTriangle,
      color: 'bg-yellow-500',
    },
    {
      name: 'Valor Inventario',
      value: '$0.00',
      icon: DollarSign,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Resumen general del sistema
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Welcome Message */}
      <div className="card">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            ¡Bienvenido al Sistema de Gestión de Víveres!
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            El sistema ha sido inicializado correctamente. Comience agregando productos,
            configurando depósitos y gestionando su inventario.
          </p>
          <div className="mt-6 flex justify-center space-x-4">
            <button className="btn btn-primary">
              Agregar Producto
            </button>
            <button className="btn btn-secondary">
              Ver Inventario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
