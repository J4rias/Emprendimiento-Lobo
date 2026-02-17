import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saleService } from '../services/api/saleService';
import { productService } from '../services/api/productService';
import { inventoryService } from '../services/api/inventoryService';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import { deliveryService } from '../services/api/deliveryService';
import {
  DollarSign,
  TrendingUp,
  Package,
  ShoppingCart,
  AlertTriangle,
  TruckIcon,
  Users,
  ArrowUp,
  ArrowDown,
  Clock
} from 'lucide-react';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    sales: null,
    products: null,
    inventory: null,
    purchaseOrders: null,
    deliveries: null
  });

  useEffect(() => {
    fetchAllStats();
  }, []);

  const fetchAllStats = async () => {
    try {
      setLoading(true);

      // Get date ranges
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

      // Fetch all stats in parallel
      const [salesStats, productsData, lowStockData, purchaseOrdersStats, deliveriesStats] = await Promise.all([
        saleService.getStats({ start_date: startOfMonth, end_date: endOfMonth }).catch(() => null),
        productService.getAll({ limit: 10 }).catch(() => ({ data: [] })),
        inventoryService.getLowStock({ limit: 10 }).catch(() => ({ data: [] })),
        purchaseOrderService.getStats().catch(() => null),
        deliveryService.getStats().catch(() => null)
      ]);

      setStats({
        sales: salesStats?.data || null,
        products: productsData.data || [],
        lowStock: lowStockData.data || [],
        purchaseOrders: purchaseOrdersStats?.data || null,
        deliveries: deliveriesStats?.data || null
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-1">Resumen general del sistema</p>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Sales Today */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ventas del Mes</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {stats.sales?.total_sales || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                S/ {parseFloat(stats.sales?.total_amount || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-blue-50 rounded-full p-3">
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Products */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {stats.products?.length || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">En catálogo</p>
            </div>
            <div className="bg-green-50 rounded-full p-3">
              <Package className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {stats.lowStock?.length || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">Productos críticos</p>
            </div>
            <div className="bg-orange-50 rounded-full p-3">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Pending Deliveries */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Entregas Pendientes</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {stats.deliveries?.pending_deliveries || 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.deliveries?.in_transit_deliveries || 0} en tránsito
              </p>
            </div>
            <div className="bg-purple-50 rounded-full p-3">
              <TruckIcon className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ventas por Tipo</h2>
          {stats.sales?.sales_by_type && stats.sales.sales_by_type.length > 0 ? (
            <div className="space-y-3">
              {stats.sales.sales_by_type.map((type, index) => {
                const total = stats.sales.sales_by_type.reduce((sum, t) => sum + parseInt(t.count), 0);
                const percentage = total > 0 ? (parseInt(type.count) / total * 100).toFixed(1) : 0;
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">
                        {type.sale_type === 'cash' ? 'Contado' : 'Crédito'}
                      </span>
                      <span className="text-gray-600">{type.count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${type.sale_type === 'cash' ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay datos de ventas</p>
          )}
        </div>

        {/* Purchase Orders Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Órdenes de Compra</h2>
          {stats.purchaseOrders?.orders_by_status && stats.purchaseOrders.orders_by_status.length > 0 ? (
            <div className="space-y-3">
              {stats.purchaseOrders.orders_by_status.map((status, index) => {
                const total = stats.purchaseOrders.orders_by_status.reduce((sum, s) => sum + parseInt(s.count), 0);
                const percentage = total > 0 ? (parseInt(status.count) / total * 100).toFixed(1) : 0;
                const statusLabels = {
                  draft: 'Borrador',
                  sent: 'Enviada',
                  confirmed: 'Confirmada',
                  partially_received: 'Parcialmente Recibida',
                  received: 'Recibida',
                  cancelled: 'Cancelada'
                };
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{statusLabels[status.status] || status.status}</span>
                      <span className="text-gray-600">{status.count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay órdenes de compra</p>
          )}
        </div>
      </div>

      {/* Low Stock Products */}
      {stats.lowStock && stats.lowStock.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Productos con Stock Bajo</h2>
              <button
                onClick={() => navigate('/inventory')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Ver todo
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Almacén</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Actual</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mínimo</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.lowStock.slice(0, 5).map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.product?.name}</div>
                      <div className="text-xs text-gray-500">{item.product?.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.warehouse?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {item.quantity || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                      {item.product?.minimum_stock || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Crítico
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => navigate('/pos')}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow"
        >
          <ShoppingCart className="w-8 h-8 mb-2" />
          <h3 className="text-lg font-semibold">Nueva Venta</h3>
          <p className="text-sm opacity-90 mt-1">Punto de venta</p>
        </button>

        <button
          onClick={() => navigate('/purchase-orders/create')}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow"
        >
          <Package className="w-8 h-8 mb-2" />
          <h3 className="text-lg font-semibold">Nueva Orden</h3>
          <p className="text-sm opacity-90 mt-1">Orden de compra</p>
        </button>

        <button
          onClick={() => navigate('/inventory/adjust')}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow"
        >
          <AlertTriangle className="w-8 h-8 mb-2" />
          <h3 className="text-lg font-semibold">Ajustar Stock</h3>
          <p className="text-sm opacity-90 mt-1">Ajuste de inventario</p>
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
