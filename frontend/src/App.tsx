import React, { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lazy-loaded pages — each page loads only when first visited
const LoginPage               = lazy(() => import('./pages/LoginPage'));
const Dashboard               = lazy(() => import('./pages/Dashboard'));
const InventoryPage           = lazy(() => import('./pages/InventoryPage'));
const InventoryDetailPage     = lazy(() => import('./pages/InventoryDetailPage'));
const TransfersPage           = lazy(() => import('./pages/TransfersPage'));
const InventoryMovementsPage  = lazy(() => import('./pages/InventoryMovementsPage'));
const ProductsPage            = lazy(() => import('./pages/ProductsPage'));
const QuotesPage              = lazy(() => import('./pages/QuotesPage'));
const CustomersPage           = lazy(() => import('./pages/CustomersPage'));
const UsersPage               = lazy(() => import('./pages/UsersPage'));
const SettingsPage            = lazy(() => import('./pages/SettingsPage'));
const POSPageNew              = lazy(() => import('./pages/POSPageNew'));
const POSPageTablet           = lazy(() => import('./pages/POSPageTablet'));
const SalesPage               = lazy(() => import('./pages/SalesPage'));
const StockReplenishmentPage  = lazy(() => import('./pages/StockReplenishmentPage'));
const CategoriesPage          = lazy(() => import('./pages/CategoriesPage'));
const SuppliersPage           = lazy(() => import('./pages/SuppliersPage'));
const BrandsPage              = lazy(() => import('./pages/BrandsPage'));
const ExchangeRatesPage       = lazy(() => import('./pages/ExchangeRatesPage'));
const ReportsPage             = lazy(() => import('./pages/ReportsPage'));
const CommissionsPage         = lazy(() => import('./pages/CommissionsPage'));
const PurchaseOrdersPage      = lazy(() => import('./pages/PurchaseOrdersPage'));
const PurchaseOrderCreatePage = lazy(() => import('./pages/PurchaseOrderCreatePage'));
const PurchaseOrderReceivePage= lazy(() => import('./pages/PurchaseOrderReceivePage'));
const CreditNotesPage         = lazy(() => import('./pages/CreditNotesPage'));
const DeliveriesPage          = lazy(() => import('./pages/DeliveriesPage'));
const SupplierPaymentsPage    = lazy(() => import('./pages/SupplierPaymentsPage'));
const SupplierResumenPage     = lazy(() => import('./pages/SupplierResumenPage'));
const PriceListsPage          = lazy(() => import('./pages/PriceListsPage'));
const DailyReportPage              = lazy(() => import('./pages/DailyReportPage'));
const AccountsReceivablePage       = lazy(() => import('./pages/AccountsReceivablePage'));
const ARCustomerDetailPage         = lazy(() => import('./pages/ARCustomerDetailPage'));
const CatalogPage                  = lazy(() => import('./pages/CatalogPage'));
const PreOrdersPage                = lazy(() => import('./pages/PreOrdersPage'));
const SupplierStatementPage        = lazy(() => import('./pages/SupplierStatementPage'));

const LoadingFallback = () => (
  <div className="min-h-[400px] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
      <p className="mt-3 text-sm text-gray-500">Cargando...</p>
    </div>
  </div>
);

// Route → permission mapping (must match Sidebar MENU permissions)
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard':                'dashboard.view',
  '/inventario':               'inventory.adjust',
  '/inventario/movimientos':   'inventory.adjust',
  '/reponer-stock':            'inventory.adjust',
  '/transferencias':           'inventory.transfer',
  '/productos':                'products.create',
  '/categorias':               'products.create',
  '/proveedores':              'suppliers.view',
  '/marcas':                   'products.create',
  '/clientes':                 'customers.view',
  '/listas-precios':           'price_lists.view',
  '/pos/new':                  'sales.create',
  '/pos/tablet':               'sales.create',
  '/ventas':                   'sales.view',
  '/cotizaciones':             'sales.quotes.view',
  '/pre-pedidos':              'pre_orders.view',
  '/purchase-orders':          'purchases.view',
  '/purchase-orders/create':   'purchases.view',
  '/deliveries':               'deliveries.view',
  '/credit-notes':             'credit_notes.view',
  '/supplier-payments':        'supplier_payments.view',
  '/cuentas-por-pagar':        'suppliers.view',
  '/cuentas-por-cobrar':       'ar.view',
  '/reportes':                 'reports.view',
  '/comisiones':               'commissions.view',
  '/cierre-caja':              'sales.collect',
  '/configuracion':            'settings.manage',
  '/tasas-cambio':             'settings.manage',
};

// Ordered list of routes to try as default landing page
const DEFAULT_ROUTES = [
  '/dashboard', '/ventas', '/pos/new', '/clientes', '/inventario',
  '/productos', '/reportes', '/configuracion',
];

const PrivateRoute = ({ children, permission }: { children: React.ReactNode; permission?: string }) => {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  if (permission && !hasPermission(permission)) {
    const fallback = DEFAULT_ROUTES.find(r => {
      const perm = ROUTE_PERMISSIONS[r];
      return !perm || hasPermission(perm);
    }) || '/login';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

const DefaultRedirect = () => {
  const { user, hasPermission } = useAuth();
  if (!user) return <Navigate to="/login" />;
  const target = DEFAULT_ROUTES.find(r => {
    const perm = ROUTE_PERMISSIONS[r];
    return !perm || hasPermission(perm);
  }) || '/login';
  return <Navigate to={target} replace />;
};

const COLLAPSED_KEY = 'atlas-sidebar-collapsed';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
  });

  const handleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onCollapse={handleCollapse}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<LoadingFallback />}>
    <Routes>
      <Route path="/catalogo" element={<CatalogPage />} />
      <Route
        path="/login"
        element={user ? <DefaultRedirect /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute permission="dashboard.view">
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route path="/inventario" element={<PrivateRoute permission="inventory.adjust"><AppLayout><InventoryPage /></AppLayout></PrivateRoute>} />
      <Route path="/inventario/:id" element={<PrivateRoute permission="inventory.adjust"><AppLayout><InventoryDetailPage /></AppLayout></PrivateRoute>} />
      <Route path="/transferencias" element={<PrivateRoute permission="inventory.transfer"><AppLayout><TransfersPage /></AppLayout></PrivateRoute>} />
      <Route path="/inventario/movimientos" element={<PrivateRoute permission="inventory.adjust"><AppLayout><InventoryMovementsPage /></AppLayout></PrivateRoute>} />
      <Route path="/productos" element={<PrivateRoute permission="products.create"><AppLayout><ProductsPage /></AppLayout></PrivateRoute>} />
      <Route path="/cotizaciones" element={<PrivateRoute permission="sales.quotes.view"><AppLayout><QuotesPage /></AppLayout></PrivateRoute>} />
      <Route path="/pos/new" element={<PrivateRoute permission="sales.create"><ErrorBoundary><POSPageNew /></ErrorBoundary></PrivateRoute>} />
      <Route path="/pos/tablet" element={<PrivateRoute permission="sales.create"><ErrorBoundary><POSPageTablet /></ErrorBoundary></PrivateRoute>} />
      <Route path="/ventas" element={<PrivateRoute permission="sales.view"><AppLayout><SalesPage /></AppLayout></PrivateRoute>} />
      <Route path="/reponer-stock" element={<PrivateRoute permission="inventory.adjust"><ErrorBoundary><StockReplenishmentPage /></ErrorBoundary></PrivateRoute>} />
      <Route path="/categorias" element={<PrivateRoute permission="products.create"><AppLayout><CategoriesPage /></AppLayout></PrivateRoute>} />
      <Route path="/proveedores" element={<PrivateRoute permission="suppliers.view"><AppLayout><SuppliersPage /></AppLayout></PrivateRoute>} />
      <Route path="/proveedores/:id/estado-cuenta" element={<PrivateRoute permission="suppliers.view"><AppLayout><SupplierStatementPage /></AppLayout></PrivateRoute>} />
      <Route path="/marcas" element={<PrivateRoute permission="products.create"><AppLayout><BrandsPage /></AppLayout></PrivateRoute>} />
      <Route path="/clientes" element={<PrivateRoute permission="customers.view"><AppLayout><CustomersPage /></AppLayout></PrivateRoute>} />
      <Route path="/usuarios" element={<PrivateRoute permission="settings.manage"><AppLayout><UsersPage /></AppLayout></PrivateRoute>} />
      <Route path="/configuracion" element={<PrivateRoute permission="settings.manage"><AppLayout><SettingsPage /></AppLayout></PrivateRoute>} />
      <Route path="/tasas-cambio" element={<PrivateRoute permission="settings.manage"><AppLayout><ExchangeRatesPage /></AppLayout></PrivateRoute>} />
      <Route path="/purchase-orders" element={<PrivateRoute permission="purchases.view"><AppLayout><PurchaseOrdersPage /></AppLayout></PrivateRoute>} />
      <Route path="/purchase-orders/create" element={<PrivateRoute permission="purchases.view"><AppLayout><PurchaseOrderCreatePage /></AppLayout></PrivateRoute>} />
      <Route path="/purchase-orders/edit/:id" element={<PrivateRoute permission="purchases.view"><AppLayout><PurchaseOrderCreatePage /></AppLayout></PrivateRoute>} />
      <Route path="/purchase-orders/receive/:id" element={<PrivateRoute permission="purchases.view"><AppLayout><PurchaseOrderReceivePage /></AppLayout></PrivateRoute>} />
      <Route path="/credit-notes" element={<PrivateRoute permission="credit_notes.view"><AppLayout><CreditNotesPage /></AppLayout></PrivateRoute>} />
      <Route path="/deliveries" element={<PrivateRoute permission="deliveries.view"><AppLayout><DeliveriesPage /></AppLayout></PrivateRoute>} />
      <Route path="/listas-precios" element={<PrivateRoute permission="price_lists.view"><AppLayout><PriceListsPage /></AppLayout></PrivateRoute>} />
      <Route path="/supplier-payments" element={<PrivateRoute permission="supplier_payments.view"><AppLayout><SupplierPaymentsPage /></AppLayout></PrivateRoute>} />
      <Route path="/cuentas-por-pagar" element={<PrivateRoute permission="suppliers.view"><AppLayout><SupplierResumenPage /></AppLayout></PrivateRoute>} />
      <Route path="/pre-pedidos" element={<PrivateRoute permission="pre_orders.view"><AppLayout><PreOrdersPage /></AppLayout></PrivateRoute>} />
      <Route path="/reportes" element={<PrivateRoute permission="reports.view"><AppLayout><ReportsPage /></AppLayout></PrivateRoute>} />
      <Route path="/comisiones" element={<PrivateRoute permission="commissions.view"><AppLayout><CommissionsPage /></AppLayout></PrivateRoute>} />
      <Route path="/cuentas-por-cobrar" element={<PrivateRoute permission="ar.view"><AppLayout><AccountsReceivablePage /></AppLayout></PrivateRoute>} />
      <Route path="/cuentas-por-cobrar/clientes" element={<PrivateRoute permission="ar.view"><AppLayout><AccountsReceivablePage /></AppLayout></PrivateRoute>} />
      <Route path="/cuentas-por-cobrar/cliente/:id" element={<PrivateRoute permission="ar.view"><AppLayout><ARCustomerDetailPage /></AppLayout></PrivateRoute>} />
      <Route path="/cierre-caja" element={<PrivateRoute permission="sales.collect"><AppLayout><DailyReportPage /></AppLayout></PrivateRoute>} />
      <Route path="/" element={<DefaultRedirect />} />
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <AppRoutes />
      </CompanyProvider>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ duration: 3000 }}
      />
    </AuthProvider>
  );
}

export default App;
