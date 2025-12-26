import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Scan,
  Warehouse,
  ShoppingCart,
  TrendingUp,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Shield,
  UserCog,
  UserCheck,
  FileText,
  FileSpreadsheet,
  ShoppingBag,
  DollarSign,
  BarChart3,
  CreditCard,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';

const Sidebar = ({ isOpen, onClose }) => {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const [productsOpen, setProductsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Rutas de los subitems de cada acordeón
  const productsRoutes = ['/productos', '/categorias', '/proveedores', '/marcas'];
  const configRoutes = ['/usuarios', '/roles', '/configuracion', '/tasas-cambio'];

  // Efecto para controlar el estado de los acordeones basado en la ruta actual
  useEffect(() => {
    const currentPath = location.pathname;
    
    // Verificar si la ruta actual pertenece a algún acordeón
    const isInProducts = productsRoutes.some(route => currentPath === route);
    const isInConfig = configRoutes.some(route => currentPath === route);
    
    // Actualizar estados
    setProductsOpen(isInProducts);
    setConfigOpen(isInConfig);
  }, [location.pathname]);

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
      name: 'Reponer Stock',
      icon: Scan,
      path: '/reponer-stock',
      permission: 'inventory.adjust',
    },
    {
      name: 'Transferencias',
      icon: ArrowRightLeft,
      path: '/transferencias',
      permission: 'inventory.transfer',

    },
    {
      name: 'Productos',
      icon: Warehouse,
      permission: 'products.view',
      isAccordion: true,
      items: [
        {
          name: 'Lista de Productos',
          path: '/productos',
          permission: 'products.view',
        },
        {
          name: 'Categorías',
          path: '/categorias',
          permission: 'products.view',
        },
        {
          name: 'Proveedores',
          path: '/proveedores',
          permission: 'suppliers.view',
        },
        {
          name: 'Marcas',
          path: '/marcas',
          permission: 'products.view',
        },
      ],
    },
    {
      name: 'Clientes',
      icon: UserCheck,
      path: '/clientes',
      permission: 'sales.view',
    },
    {
      name: 'Cotizaciones',
      icon: FileSpreadsheet,
      path: '/cotizaciones',
      permission: 'quotes.view',
    },
    {
      name: 'Punto de Venta',
      icon: CreditCard,
      path: '/pos',
      permission: 'sales.create',
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
      name: 'Configuración',
      icon: Shield,
      permission: 'users.view', // Mostrar si tiene permiso de usuarios o configuración
      isAccordion: true,
      items: [
        {
          name: 'Usuarios',
          path: '/usuarios',
          permission: 'users.view',
        },
        {
          name: 'Roles',
          path: '/roles',
          permission: 'users.manage',
        },
        {
          name: 'Configuración General',
          path: '/configuracion',
          permission: 'settings.manage',
        },
        {
          name: 'Tasas de Cambio',
          path: '/tasas-cambio',
          permission: 'settings.manage',
        },
      ],
    },
  ];

  const visibleItems = menuItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const renderMenuItem = (item) => {
    if (item.isAccordion) {
      const visibleSubItems = item.items.filter(
        (subItem) => !subItem.permission || hasPermission(subItem.permission)
      );

      // Si ningún subitem es visible, no mostrar el acordeón
      if (visibleSubItems.length === 0) return null;

      // Determinar qué acordeón es y su estado
      const isProductsAccordion = item.name === 'Productos';
      const isOpen = isProductsAccordion ? productsOpen : configOpen;
      const toggleOpen = isProductsAccordion ? () => setProductsOpen(!productsOpen) : () => setConfigOpen(!configOpen);

      return (
        <div key={`${item.name.toLowerCase()}-accordion`} className="space-y-1">
          <button
            onClick={toggleOpen}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isOpen
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center">
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          
          {isOpen && (
            <div className="ml-8 space-y-1">
              {visibleSubItems.map((subItem) => (
                <NavLink
                  key={subItem.path}
                  to={subItem.path}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 text-sm rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {subItem.name}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
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
    );
  };

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
            {visibleItems.map((item) => renderMenuItem(item))}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
