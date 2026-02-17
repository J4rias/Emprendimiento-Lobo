import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import InventoryPage from './pages/InventoryPage';
import InventoryDetailPage from './pages/InventoryDetailPage';
import InventoryAdjustPage from './pages/InventoryAdjustPage';
import TransfersPage from './pages/TransfersPage';
import InventoryMovementsPage from './pages/InventoryMovementsPage';
import ProductsPage from './pages/ProductsPage';
import QuotesPage from './pages/QuotesPage';
import CustomersPage from './pages/CustomersPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import POSPage from './pages/POSPage';
import SalesPage from './pages/SalesPage';
import StockReplenishmentPage from './pages/StockReplenishmentPage';
import CategoriesPage from './pages/CategoriesPage';
import SuppliersPage from './pages/SuppliersPage';
import BrandsPage from './pages/BrandsPage';
import ExchangeRatesPage from './pages/ExchangeRatesPage';
import ReportsPage from './pages/ReportsPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import PurchaseOrderCreatePage from './pages/PurchaseOrderCreatePage';
import PurchaseOrderReceivePage from './pages/PurchaseOrderReceivePage';
import CreditNotesPage from './pages/CreditNotesPage';
import CreditNoteCreatePage from './pages/CreditNoteCreatePage';
import DeliveriesPage from './pages/DeliveriesPage';
import SupplierPaymentsPage from './pages/SupplierPaymentsPage';

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
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

function AppRoutes() {
  const { user } = useAuth();

  return (
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
            <POSPage />
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
            <StockReplenishmentPage />
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
        path="/credit-notes/create"
        element={
          <PrivateRoute>
            <AppLayout>
              <CreditNoteCreatePage />
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
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
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
