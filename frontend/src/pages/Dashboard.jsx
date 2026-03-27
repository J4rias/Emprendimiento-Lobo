import { useQuery } from '@tanstack/react-query';
import { Package, ShoppingCart, AlertTriangle, DollarSign, Users, FileText, TrendingUp, Calendar, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../services/api/productService';
import { inventoryService } from '../services/api/inventoryService';
import { saleService } from '../services/api/saleService';
import { categoryService } from '../services/api/categoryService';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../utils/formatUtils';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getDashboardStats = async () => {
    const productsData = await productService.getAll({ limit: 1 }).catch(() => ({ pagination: { total: 0 } }));
    const lowStockData = await inventoryService.getLowStock().catch(() => ({ data: [] }));
    const valuationData = await inventoryService.getValuation().catch(() => ({ data: { totalValue: 0 } }));
    const categoriesData = await categoryService.getAll({ limit: 100 }).catch(() => ({ data: [] }));

    // Stats for TODAY
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const todayStart = `${localDate}T00:00:00`;
    const todayEnd = `${localDate}T23:59:59`;
    const todayStats = await saleService.getSalesStats({ start_date: todayStart, end_date: todayEnd }).catch(() => ({ stats: { totalSales: 0, totalRevenueCOP: 0 } }));

    // Stats for MONTH
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthDate = `${firstDayOfMonth.getFullYear()}-${pad(firstDayOfMonth.getMonth() + 1)}-01`;
    const monthStatsData = await saleService.getSalesStats({ start_date: `${monthDate}T00:00:00` }).catch(() => ({ stats: { totalRevenueCOP: 0 } }));

    // Pending sales
    const pendingData = await saleService.getSales({ status: 'pending', limit: 1 }).catch(() => ({ pagination: { total: 0 } }));

    return {
      totalProducts: productsData.pagination?.total || 0,
      todaySales: todayStats.stats?.totalSales || 0,
      todayRevenueCOP: todayStats.stats?.totalRevenueCOP || 0,
      lowStock: lowStockData.data?.length || 0,
      inventoryValue: valuationData.data?.totalValue || 0,
      pendingSales: pendingData.pagination?.total || 0,
      monthRevenueCOP: monthStatsData.stats?.totalRevenueCOP || 0,
      categoriesStats: categoriesData.data || []
    };
  };

  const { data: dashboardData = {}, isLoading: loading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
    staleTime: 60_000,
  });

  const stats = {
    totalProducts: dashboardData.totalProducts || 0,
    todaySales: dashboardData.todaySales || 0,
    todayRevenueCOP: dashboardData.todayRevenueCOP || 0,
    lowStock: dashboardData.lowStock || 0,
    inventoryValue: dashboardData.inventoryValue || 0,
    pendingSales: dashboardData.pendingSales || 0,
    monthRevenueCOP: dashboardData.monthRevenueCOP || 0
  };

  const categoriesStats = dashboardData.categoriesStats || [];

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
      subtitle: `COP ${Math.round(stats.todayRevenueCOP).toLocaleString('de-DE')}`,
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
      value: formatMoney(stats.inventoryValue),
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
      value: `COP ${Math.round(stats.monthRevenueCOP).toLocaleString('de-DE')}`,
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

      {/* Categories Overview */}
      {categoriesStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Productos por Categoría
            </h2>
            <button
              onClick={() => navigate('/categorias')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todas
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {categoriesStats
              .filter(cat => cat.productCount > 0)
              .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
              .slice(0, 6)
              .map((category) => (
                <button
                  key={category.id}
                  onClick={() => navigate(`/productos?category=${category.id}`)}
                  className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:shadow-md transition-shadow"
                    style={{ backgroundColor: category.color || '#6B7280' }}
                  >
                    {category.productCount || 0}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-gray-900 truncate w-full">
                      {category.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      producto{category.productCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

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
