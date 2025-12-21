import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  FileText,
  Users,
  Settings,
  BarChart3,
  Warehouse,
  DollarSign,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { hasPermission } = useAuth();

  const menuItems = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      permission: null,
    },
    {
      name: 'Inventario',
      icon: Package,
      path: '/inventario',
      permission: 'inventory.view',
    },
    {
      name: 'Productos',
      icon: Warehouse,
      path: '/productos',
      permission: 'products.view',
    },
    {
      name: 'Ventas',
      icon: ShoppingCart,
      path: '/ventas',
      permission: 'sales.view',
    },
    {
      name: 'Compras',
      icon: ShoppingBag,
      path: '/compras',
      permission: 'purchases.view',
    },
    {
      name: 'Facturación',
      icon: FileText,
      path: '/facturacion',
      permission: 'invoices.view',
    },
    {
      name: 'Cuentas',
      icon: DollarSign,
      path: '/cuentas',
      permission: 'accounts.view',
    },
    {
      name: 'Reportes',
      icon: BarChart3,
      path: '/reportes',
      permission: 'reports.view',
    },
    {
      name: 'Usuarios',
      icon: Users,
      path: '/usuarios',
      permission: 'users.view',
    },
    {
      name: 'Configuración',
      icon: Settings,
      path: '/configuracion',
      permission: 'settings.manage',
    },
  ];

  const visibleItems = menuItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Close button (mobile only) */}
          <div className="lg:hidden flex justify-end p-4">
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
