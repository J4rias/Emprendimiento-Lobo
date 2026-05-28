import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
const InventoryAdjustPage     = lazy(() => import('./pages/InventoryAdjustPage'));
const TransfersPage           = lazy(() => import('./pages/TransfersPage'));
const InventoryMovementsPage  = lazy(() => import('./pages/InventoryMovementsPage'));
const ProductsPage            = lazy(() => import('./pages/ProductsPage'));
const QuotesPage              = lazy(() => import('./pages/QuotesPage'));
const CustomersPage           = lazy(() => import('./pages/CustomersPage'));
const UsersPage               = lazy(() => import('./pages/UsersPage'));
const SettingsPage            = lazy(() => import('./pages/SettingsPage'));
const POSPage                 = lazy(() => import('./pages/POSPage'));
const POSPageNew              = lazy(() => import('./pages/POSPageNew'));
const POSPageTablet           = lazy(() => import('./pages/POSPageTablet'));
const SalesPage               = lazy(() => import('./pages/SalesPage'));
const StockReplenishmentPage  = lazy(() => import('./pages/StockReplenishmentPage'));
const CategoriesPage          = lazy(() => import('./pages/CategoriesPage'));
const SuppliersPage           = lazy(() => import('./pages/SuppliersPage'));
const BrandsPage              = lazy(() => import('./pages/BrandsPage'));
const ExchangeRatesPage       = lazy(() => import('./pages/ExchangeRatesPage'));
const ReportsPage             = lazy(() => import('./pages/ReportsPage'));
const PurchaseOrdersPage      = lazy(() => import('./pages/PurchaseOrdersPage'));
const PurchaseOrderCreatePage = lazy(() => import('./pages/PurchaseOrderCreatePage'));
const PurchaseOrderReceivePage= lazy(() => import('./pages/PurchaseOrderReceivePage'));
const CreditNotesPage         = lazy(() => import('./pages/CreditNotesPage'));
const DeliveriesPage          = lazy(() => import('./pages/DeliveriesPage'));
const SupplierPaymentsPage    = lazy(() => import('./pages/SupplierPaymentsPage'));
const PriceListsPage          = lazy(() => import('./pages/PriceListsPage'));
const DailyReportPage              = lazy(() => import('./pages/DailyReportPage'));
const AccountsReceivablePage       = lazy(() => import('./pages/AccountsReceivablePage'));
const ARCustomerDetailPage         = lazy(() => import('./pages/ARCustomerDetailPage'));

const LoadingFallback = () => (
  <div className="min-h-[400px] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
      <p className="mt-3 text-sm text-gray-500">Cargando...</p>
    </div>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

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

  return user ? children : <Navigate to="/login" />;
};

const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventario"
        element={
          <PrivateRoute>
            <AppLayout>
              <InventoryPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventario/:id"
        element={
          <PrivateRoute>
            <AppLayout>
              <InventoryDetailPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventario/:id/adjust"
        element={
          <PrivateRoute>
            <AppLayout>
              <InventoryAdjustPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/transferencias"
        element={
          <PrivateRoute>
            <AppLayout>
              <TransfersPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventario/movimientos"
        element={
          <PrivateRoute>
            <AppLayout>
              <InventoryMovementsPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/productos"
        element={
          <PrivateRoute>
            <AppLayout>
              <ProductsPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/cotizaciones"
        element={
          <PrivateRoute>
            <AppLayout>
              <QuotesPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/pos"
        element={
          <PrivateRoute>
            <ErrorBoundary><POSPage /></ErrorBoundary>
          </PrivateRoute>
        }
      />
      <Route
        path="/pos/new"
        element={
          <PrivateRoute>
            <ErrorBoundary><POSPageNew /></ErrorBoundary>
          </PrivateRoute>
        }
      />
      <Route
        path="/pos/tablet"
        element={
          <PrivateRoute>
            <ErrorBoundary><POSPageTablet /></ErrorBoundary>
          </PrivateRoute>
        }
      />
      <Route
        path="/ventas"
        element={
          <PrivateRoute>
            <AppLayout>
              <SalesPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/reponer-stock"
        element={
          <PrivateRoute>
            <ErrorBoundary><StockReplenishmentPage /></ErrorBoundary>
          </PrivateRoute>
        }
      />
      <Route
        path="/categorias"
        element={
          <PrivateRoute>
            <AppLayout>
              <CategoriesPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/proveedores"
        element={
          <PrivateRoute>
            <AppLayout>
              <SuppliersPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/marcas"
        element={
          <PrivateRoute>
            <AppLayout>
              <BrandsPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/clientes"
        element={
          <PrivateRoute>
            <AppLayout>
              <CustomersPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <PrivateRoute>
            <AppLayout>
              <UsersPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/configuracion"
        element={
          <PrivateRoute>
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/tasas-cambio"
        element={
          <PrivateRoute>
            <AppLayout>
              <ExchangeRatesPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/purchase-orders"
        element={
          <PrivateRoute>
            <AppLayout>
              <PurchaseOrdersPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/purchase-orders/create"
        element={
          <PrivateRoute>
            <AppLayout>
              <PurchaseOrderCreatePage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/purchase-orders/edit/:id"
        element={
          <PrivateRoute>
            <AppLayout>
              <PurchaseOrderCreatePage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/purchase-orders/receive/:id"
        element={
          <PrivateRoute>
            <AppLayout>
              <PurchaseOrderReceivePage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/credit-notes"
        element={
          <PrivateRoute>
            <AppLayout>
              <CreditNotesPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/deliveries"
        element={
          <PrivateRoute>
            <AppLayout>
              <DeliveriesPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/listas-precios"
        element={
          <PrivateRoute>
            <AppLayout>
              <PriceListsPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/supplier-payments"
        element={
          <PrivateRoute>
            <AppLayout>
              <SupplierPaymentsPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/reportes"
        element={
          <PrivateRoute>
            <AppLayout>
              <ReportsPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/cuentas-por-cobrar"
        element={
          <PrivateRoute>
            <AppLayout>
              <AccountsReceivablePage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/cuentas-por-cobrar/clientes"
        element={
          <PrivateRoute>
            <AppLayout>
              <AccountsReceivablePage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/cuentas-por-cobrar/cliente/:id"
        element={
          <PrivateRoute>
            <AppLayout>
              <ARCustomerDetailPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/cierre-caja"
        element={
          <PrivateRoute>
            <AppLayout>
              <DailyReportPage />
            </AppLayout>
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
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
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </AuthProvider>
  );
}

export default App;
