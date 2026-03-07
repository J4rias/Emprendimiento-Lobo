import { useState } from 'react';
import { saleService } from '../services/api/saleService';
import { inventoryService } from '../services/api/inventoryService';
import { purchaseOrderService } from '../services/api/purchaseOrderService';
import { productService } from '../services/api/productService';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  Package,
  ShoppingCart,
  DollarSign
} from 'lucide-react';

const ReportsPage = () => {
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const reportTypes = [
    { value: 'sales', label: 'Reporte de Ventas', icon: DollarSign },
    { value: 'inventory', label: 'Inventario Valorizado', icon: Package },
    { value: 'purchases', label: 'Reporte de Compras', icon: ShoppingCart },
    { value: 'top_products', label: 'Productos Más Vendidos', icon: TrendingUp },
    { value: 'low_stock', label: 'Productos con Bajo Stock', icon: Package }
  ];

  const generateReport = async () => {
    try {
      setLoading(true);
      setReportData(null);
      setStats(null);

      switch (reportType) {
        case 'sales':
          await generateSalesReport();
          break;
        case 'inventory':
          await generateInventoryReport();
          break;
        case 'purchases':
          await generatePurchasesReport();
          break;
        case 'top_products':
          await generateTopProductsReport();
          break;
        case 'low_stock':
          await generateLowStockReport();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const generateSalesReport = async () => {
    const [salesStats, salesList] = await Promise.all([
      saleService.getSalesStats(dateRange),
      saleService.getSales({ ...dateRange, limit: 1000 })
    ]);

    setStats({
      total_sales: salesStats.data?.total_sales || 0,
      total_amount: salesStats.data?.total_amount || 0,
      average_ticket: salesStats.data?.average_ticket || 0,
      sales_by_type: salesStats.data?.sales_by_type || []
    });

    setReportData(salesList.data || []);
  };

  const generateInventoryReport = async () => {
    const inventoryData = await inventoryService.getAll({ limit: 1000 });

    let totalValue = 0;
    const processedData = (inventoryData.data || []).map(item => {
      const value = (item.quantity || 0) * (item.product?.cost || 0);
      totalValue += value;
      return {
        ...item,
        value
      };
    });

    setStats({
      total_items: processedData.length,
      total_value: totalValue,
      total_quantity: processedData.reduce((sum, item) => sum + (item.quantity || 0), 0)
    });

    setReportData(processedData);
  };

  const generatePurchasesReport = async () => {
    const purchaseOrders = await purchaseOrderService.getAll({
      ...dateRange,
      limit: 1000
    });

    const totalAmount = (purchaseOrders.data || []).reduce((sum, po) => sum + parseFloat(po.total || 0), 0);

    setStats({
      total_orders: purchaseOrders.data?.length || 0,
      total_amount: totalAmount,
      average_order: purchaseOrders.data?.length > 0 ? totalAmount / purchaseOrders.data.length : 0
    });

    setReportData(purchaseOrders.data || []);
  };

  const generateTopProductsReport = async () => {
    const salesData = await saleService.getAll({
      ...dateRange,
      limit: 1000
    });

    // Aggregate product sales
    const productMap = {};
    (salesData.data || []).forEach(sale => {
      (sale.details || []).forEach(detail => {
        const productId = detail.product_id;
        if (!productMap[productId]) {
          productMap[productId] = {
            product: detail.product,
            total_quantity: 0,
            total_amount: 0,
            sales_count: 0
          };
        }
        productMap[productId].total_quantity += (detail.package_quantity || 0) * (detail.product?.presentation?.units_per_package || 1) + (detail.loose_units || 0);
        productMap[productId].total_amount += parseFloat(detail.line_total || 0);
        productMap[productId].sales_count += 1;
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 50);

    setStats({
      total_products: topProducts.length,
      total_revenue: topProducts.reduce((sum, p) => sum + p.total_amount, 0),
      total_units_sold: topProducts.reduce((sum, p) => sum + p.total_quantity, 0)
    });

    setReportData(topProducts);
  };

  const generateLowStockReport = async () => {
    const lowStockData = await inventoryService.getLowStock({ limit: 1000 });

    setStats({
      critical_items: lowStockData.data?.length || 0
    });

    setReportData(lowStockData.data || []);
  };

  const exportToCSV = () => {
    if (!reportData || reportData.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    let csvContent = '';
    let filename = '';

    switch (reportType) {
      case 'sales':
        csvContent = generateSalesCSV();
        filename = `reporte_ventas_${dateRange.start_date}_${dateRange.end_date}.csv`;
        break;
      case 'inventory':
        csvContent = generateInventoryCSV();
        filename = `inventario_valorizado_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'purchases':
        csvContent = generatePurchasesCSV();
        filename = `reporte_compras_${dateRange.start_date}_${dateRange.end_date}.csv`;
        break;
      case 'top_products':
        csvContent = generateTopProductsCSV();
        filename = `productos_mas_vendidos_${dateRange.start_date}_${dateRange.end_date}.csv`;
        break;
      case 'low_stock':
        csvContent = generateLowStockCSV();
        filename = `productos_bajo_stock_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      default:
        return;
    }

    // Create and download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const generateSalesCSV = () => {
    let csv = 'Número,Fecha,Cliente,Tipo,Estado,Subtotal,Descuento,Impuesto,Total\n';
    reportData.forEach(sale => {
      csv += `"${sale.sale_number}","${new Date(sale.sale_date).toLocaleDateString()}","${sale.customer?.name || 'Cliente General'}","${sale.sale_type === 'cash' ? 'Contado' : 'Crédito'}","${sale.status}",${sale.subtotal},${sale.discount_amount},${sale.tax_amount},${sale.total}\n`;
    });
    return csv;
  };

  const generateInventoryCSV = () => {
    let csv = 'SKU,Producto,Almacén,Cant. Total,Existencia (Paquetes),Existencia (Unidades),Uds/Paquete,Costo Unitario,Valor Total\n';
    reportData.forEach(item => {
      const presentations = item.product?.presentations || [];
      const defaultPresentation = presentations.find(p => p.is_default) || presentations[0];
      const unitsPerPackage = defaultPresentation?.units_per_package || 1;

      const totalUnits = item.quantity || 0;
      const stockPackages = Math.floor(totalUnits / unitsPerPackage);
      const stockRemainingUnits = totalUnits % unitsPerPackage;

      csv += `"${item.product?.sku || ''}","${item.product?.name || ''}","${item.warehouse?.name || ''}",${totalUnits},${stockPackages},${stockRemainingUnits},${unitsPerPackage},${item.product?.cost || 0},${item.value || 0}\n`;
    });
    return csv;
  };

  const generatePurchasesCSV = () => {
    let csv = 'Número,Fecha,Proveedor,Estado,Moneda,Total\n';
    reportData.forEach(po => {
      csv += `"${po.order_number}","${new Date(po.order_date).toLocaleDateString()}","${po.supplier?.name || ''}","${po.status}","${po.currency}",${po.total}\n`;
    });
    return csv;
  };

  const generateTopProductsCSV = () => {
    let csv = 'SKU,Producto,Cantidad Vendida,Monto Total,Número de Ventas\n';
    reportData.forEach(item => {
      csv += `"${item.product?.sku || ''}","${item.product?.name || ''}",${item.total_quantity},${item.total_amount},${item.sales_count}\n`;
    });
    return csv;
  };

  const generateLowStockCSV = () => {
    let csv = 'SKU,Producto,Almacén,Cant. Total,Existencia (Paquetes),Existencia (Unidades),Uds/Paquete,Stock Mínimo,Estado\n';
    reportData.forEach(item => {
      const presentations = item.product?.presentations || [];
      const defaultPresentation = presentations.find(p => p.is_default) || presentations[0];
      const unitsPerPackage = defaultPresentation?.units_per_package || 1;

      const totalUnits = item.quantity || 0;
      const stockPackages = Math.floor(totalUnits / unitsPerPackage);
      const stockRemainingUnits = totalUnits % unitsPerPackage;

      csv += `"${item.product?.sku || ''}","${item.product?.name || ''}","${item.warehouse?.name || ''}",${totalUnits},${stockPackages},${stockRemainingUnits},${unitsPerPackage},${item.product?.minimum_stock || 0},"Crítico"\n`;
    });
    return csv;
  };

  const renderStatsCards = () => {
    if (!stats) return null;

    switch (reportType) {
      case 'sales':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Ventas</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_sales}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Monto Total</div>
              <div className="text-2xl font-bold text-gray-900">$ {parseFloat(stats.total_amount || 0).toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Ticket Promedio</div>
              <div className="text-2xl font-bold text-gray-900">$ {parseFloat(stats.average_ticket || 0).toFixed(2)}</div>
            </div>
          </div>
        );
      case 'inventory':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Items</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_items}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Cantidad Total</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_quantity}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Valor Total</div>
              <div className="text-2xl font-bold text-gray-900">$ {parseFloat(stats.total_value || 0).toFixed(2)}</div>
            </div>
          </div>
        );
      case 'purchases':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Órdenes</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_orders}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Monto Total</div>
              <div className="text-2xl font-bold text-gray-900">$ {parseFloat(stats.total_amount || 0).toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Promedio por Orden</div>
              <div className="text-2xl font-bold text-gray-900">$ {parseFloat(stats.average_order || 0).toFixed(2)}</div>
            </div>
          </div>
        );
      case 'top_products':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Productos</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_products}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Unidades Vendidas</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_units_sold}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Ingresos Totales</div>
              <div className="text-2xl font-bold text-gray-900">$ {parseFloat(stats.total_revenue || 0).toFixed(2)}</div>
            </div>
          </div>
        );
      case 'low_stock':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Items Críticos</div>
              <div className="text-2xl font-bold text-red-600">{stats.critical_items}</div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderReportTable = () => {
    if (!reportData || reportData.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          No hay datos para mostrar
        </div>
      );
    }

    switch (reportType) {
      case 'sales':
        return (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.map((sale, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.sale_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sale.sale_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.customer?.name || 'Cliente General'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sale.sale_type === 'cash' ? 'Contado' : 'Crédito'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    $ {parseFloat(sale.total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'inventory':
        return (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Almacén</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Unit.</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.product?.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.product?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.warehouse?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{item.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    $ {parseFloat(item.product?.cost || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    $ {parseFloat(item.value || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'purchases':
        return (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.map((po, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{po.order_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(po.order_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{po.supplier?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{po.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {po.currency} {parseFloat(po.total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'top_products':
        return (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cant. Vendida</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">N° Ventas</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.product?.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.product?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{item.total_quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    $ {parseFloat(item.total_amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">{item.sales_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'low_stock':
        return (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Almacén</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Actual</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Mínimo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.product?.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.product?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.warehouse?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">{item.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">{item.product?.minimum_stock || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Crítico
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <p className="text-gray-600 mt-1">Genera y exporta reportes del sistema</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Tipo de Reporte
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {reportTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range (only for date-dependent reports) */}
          {['sales', 'purchases', 'top_products'].includes(reportType) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>

          {reportData && reportData.length > 0 && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {renderStatsCards()}

      {/* Report Table */}
      {reportData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            {renderReportTable()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
