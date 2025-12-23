import { useState, useEffect } from 'react';
import { Package, ShoppingCart, AlertTriangle, DollarSign, Users, FileText, TrendingUp, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/api/productService';
import { inventoryService } from '../services/api/inventoryService';
import saleService from '../services/api/saleService';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0,
    todaySales: 0,
    todayRevenue: 0,
    lowStock: 0,
    inventoryValue: 0,
    totalCustomers: 0,
    pendingSales: 0,
    monthRevenue: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Cargar datos básicos
      const productsData = await productService.getAll({ limit: 1 }).catch(() => ({ pagination: { total: 0 } }));
      
      // Cargar datos de stock bajo
      const lowStockData = await inventoryService.getLowStock().catch(() => ({ data: [] }));
      
      setStats({
        totalProducts: productsData.pagination?.total || 0,
        todaySales: 0,
        todayRevenue: 0,
        lowStock: lowStockData.data?.length || 0,
        inventoryValue: 0,
        pendingSales: 0,
        monthRevenue: 0
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      name: 'Productos Totales',
      value: stats.totalProducts,
      icon: Package,
      color: 'bg-blue-500',
      link: '/productos'
    },
    {
      name: 'Ventas del Día',
      value: stats.todaySales,
      subtitle: `$${stats.todayRevenue.toFixed(2)}`,
      icon: ShoppingCart,
      color: 'bg-green-500',
      link: '/ventas'
    },
    {
      name: 'Productos Stock Bajo',
      value: stats.lowStock,
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      link: '/inventario'
    },
    {
      name: 'Valor Inventario',
      value: `$${stats.inventoryValue.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-purple-500',
      link: '/inventario'
    },
    {
      name: 'Ventas Pendientes',
      value: stats.pendingSales,
      icon: FileText,
      color: 'bg-orange-500',
      link: '/ventas'
    },
    {
      name: 'Ingresos del Mes',
      value: `$${stats.monthRevenue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      link: '/ventas'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Bienvenido, {user?.name || 'Usuario'}
          </p>
        </div>
        <button
          onClick={() => navigate('/pos')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          Ir al Punto de Venta
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((stat) => (
          <div
            key={stat.name}
            onClick={() => stat.link && navigate(stat.link)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                {stat.subtitle && (
                  <p className="text-sm text-gray-500 mt-1">{stat.subtitle}</p>
                )}
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-blue-100 p-2 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Nueva Venta</p>
              <p className="text-xs text-gray-500">Punto de venta</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/productos')}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-green-100 p-2 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Productos</p>
              <p className="text-xs text-gray-500">Gestionar catálogo</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/cotizaciones')}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-purple-100 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Cotizaciones</p>
              <p className="text-xs text-gray-500">Nueva cotización</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/clientes')}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-orange-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Clientes</p>
              <p className="text-xs text-gray-500">Gestionar clientes</p>
            </div>
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {stats.lowStock > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div className="flex-1">
              <p className="font-medium text-yellow-900">
                Tienes {stats.lowStock} producto{stats.lowStock !== 1 ? 's' : ''} con stock bajo
              </p>
              <p className="text-sm text-yellow-700">Revisa el inventario para evitar desabastecimiento</p>
            </div>
            <button
              onClick={() => navigate('/inventario')}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Ver Inventario
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
