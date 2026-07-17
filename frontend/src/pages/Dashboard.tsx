import { useQuery } from '@tanstack/react-query';
import {
  Package, ShoppingCart, Warning, CurrencyDollar, Users, FileText,
  TrendUp, Tag, Storefront, Receipt, CurrencyCircleDollar,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { inventoryService } from '../services/api/inventoryService';
import { saleService } from '../services/api/saleService';
import { categoryService } from '../services/api/categoryService';
import { useAuth } from '../context/AuthContext';
import { formatCOP, formatUSD, LOCALE } from '../utils/formatUtils';
import { Alert, Button, Card, Skeleton, StatCard } from '../components/ui';
import { localToday, localMonthStart } from '../utils/dateUtils';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getDashboardStats = async () => {
    const lowStockData = await inventoryService.getLowStock().catch(() => ({ data: [] }));
    const valuationData = await inventoryService.getValuation().catch(() => ({ data: { totalValue: 0 } }));
    const categoriesData = await categoryService.getAll({ limit: 100 }).catch(() => ({ data: [] }));

    // Hoy (medianoche local — misma semántica que el cierre de caja)
    const todayStr = localToday();
    const todayStats = await saleService.getSalesStats({
      date_from: todayStr,
      date_to: todayStr,
      top_limit: 5,
    }).catch(() => ({ data: {} }));

    // Mes en curso (solo resumen)
    const monthStatsData = await saleService.getSalesStats({
      date_from: localMonthStart(),
      date_to: todayStr,
      summary_only: 'true',
    }).catch(() => ({ data: {} }));

    // Facturas a crédito pendientes
    const pendingData = await saleService.getSales({ status: 'pending', limit: 1 }).catch(() => ({ pagination: { total: 0 } }));

    return {
      today: todayStats.data || todayStats.stats || {},
      monthRevenueCOP: (monthStatsData.data || monthStatsData.stats || {}).totalRevenueCOP || 0,
      lowStock: lowStockData.data?.length || 0,
      inventoryValueUSD: valuationData.data?.totalValue || 0,
      inventoryByCurrency: valuationData.data?.totalsByCurrency || {},
      pendingSales: pendingData.pagination?.total || 0,
      categoriesStats: categoriesData.data || [],
    };
  };

  const { data = {}, isLoading: loading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const today = data.today || {};
  const byCurr = today.salesByCurrency || {};
  const paidCOP = byCurr.COP || { count: 0, total: 0 };
  const paidUSD = byCurr.USD || { count: 0, total: 0 };
  const topProducts = (today.topProducts || []).slice(0, 5);
  const categoriesStats = data.categoriesStats || [];
  const monthName = new Date().toLocaleDateString(LOCALE, { month: 'long' });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Bienvenido, {user?.first_name || user?.name || user?.username || 'Usuario'} — {new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button size="lg" onClick={() => navigate('/pos/new')}>
          <Storefront className="w-5 h-5" />
          Ir al Punto de Venta
        </Button>
      </div>

      {/* Alerta de stock bajo */}
      {data.lowStock > 0 && (
        <Alert
          variant="warning"
          title={`${data.lowStock} producto${data.lowStock !== 1 ? 's' : ''} con stock bajo`}
          description="Revisa el inventario para evitar desabastecimiento."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/inventario')}>
              Ver Inventario
            </Button>
          }
        />
      )}

      {/* Ventas de hoy — por modo del POS */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ventas de hoy</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Recibido en COP"
            value={formatCOP(paidCOP.total)}
            detail={`${paidCOP.count} venta${paidCOP.count !== 1 ? 's' : ''}`}
            icon={CurrencyCircleDollar}
            tone="primary"
            onClick={() => navigate('/ventas')}
          />
          <StatCard
            label="Recibido en USD"
            value={formatUSD(paidUSD.total)}
            detail={`${paidUSD.count} venta${paidUSD.count !== 1 ? 's' : ''}`}
            icon={CurrencyDollar}
            tone="success"
            onClick={() => navigate('/ventas')}
          />
          <StatCard
            label="Operaciones"
            value={today.totalSales || 0}
            detail={`Equivalente total: ${formatCOP(today.totalRevenueCOP || 0)}`}
            icon={Receipt}
            tone="neutral"
            onClick={() => navigate('/ventas')}
          />
          <StatCard
            label="Ingresos del mes"
            value={formatCOP(data.monthRevenueCOP)}
            detail={monthName.charAt(0).toUpperCase() + monthName.slice(1)}
            icon={TrendUp}
            tone="primary"
            onClick={() => navigate(`/reportes?type=sales&start=${localMonthStart()}&end=${localToday()}`)}
          />
        </div>
      </div>

      {/* Estado del negocio */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Estado del negocio</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Stock bajo"
            value={data.lowStock}
            detail="Productos por debajo del punto de reorden"
            icon={Warning}
            tone={data.lowStock > 0 ? 'warning' : 'success'}
            onClick={() => navigate('/inventario')}
          />
          <StatCard
            label="Facturas por cobrar"
            value={data.pendingSales}
            detail="Ventas a crédito pendientes"
            icon={FileText}
            tone={data.pendingSales > 0 ? 'warning' : 'neutral'}
            onClick={() => navigate('/cuentas-por-cobrar')}
          />
          <StatCard
            label="Valor del inventario"
            value={formatUSD(data.inventoryValueUSD)}
            detail={[
              data.inventoryByCurrency?.USD > 0 && `USD ${formatUSD(data.inventoryByCurrency.USD)}`,
              data.inventoryByCurrency?.COP > 0 && formatCOP(data.inventoryByCurrency.COP),
            ].filter(Boolean).join(' · ') || 'Al costo de compra'}
            icon={Package}
            tone="neutral"
            onClick={() => navigate('/inventario')}
          />
        </div>
      </div>

      {/* Top productos de hoy + categorías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendUp className="w-5 h-5 text-gray-400" />
              Más vendidos hoy
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/reportes')}>
              Ver reporte
            </Button>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Sin ventas registradas hoy</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {topProducts.map((p, i) => (
                <div key={p.product_id || i} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-900 truncate">{p.product?.name || p.product_name}</span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{Math.round(parseFloat(p.total_quantity) || 0)} uds</p>
                    <p className="text-xs text-gray-500 tabular-nums">{formatUSD(p.total_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-gray-400" />
              Productos por categoría
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/categorias')}>
              Ver todas
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categoriesStats
              .filter(cat => cat.productCount > 0)
              .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
              .slice(0, 6)
              .map((category) => (
                <button
                  key={category.id}
                  onClick={() => navigate(`/productos?category=${category.id}`)}
                  className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                    style={{ backgroundColor: category.color || '#6B7280' }}
                  >
                    {category.productCount || 0}
                  </div>
                  <p className="text-xs font-medium text-gray-900 truncate w-full text-center">
                    {category.name}
                  </p>
                </button>
              ))}
          </div>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Acciones rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: ShoppingCart, label: 'Nueva venta', desc: 'Punto de venta', to: '/pos/new' },
            { icon: Package, label: 'Productos', desc: 'Gestionar catálogo', to: '/productos' },
            { icon: FileText, label: 'Cierre de caja', desc: 'Arqueo del día', to: '/cierre-caja' },
            { icon: Users, label: 'Clientes', desc: 'Gestionar clientes', to: '/clientes' },
          ].map(({ icon: Icon, label, desc, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-left"
            >
              <div className="bg-primary-50 p-2 rounded-lg shrink-0">
                <Icon className="w-5 h-5 text-primary-700" weight="duotone" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
