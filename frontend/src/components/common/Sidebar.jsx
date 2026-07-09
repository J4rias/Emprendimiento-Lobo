import { NavLink, useLocation } from 'react-router-dom';
import {
  SquaresFour,
  Package,
  Scan,
  Warehouse,
  ShoppingCart,
  TrendUp,
  Users,
  Gear,
  CaretDown,
  CaretRight,
  Shield,
  UserGear,
  UserCheck,
  ReadCvLogo,
  ShoppingBag,
  ChartBar,
  CreditCard,
  ArrowsLeftRight,
  X,
  Truck,
  FileX,
  Receipt,
  Calculator,
  BookOpen,
  ClipboardText,
  Robot,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';

const Sidebar = ({ isOpen, onClose }) => {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const [productsOpen, setProductsOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [arOpen, setArOpen] = useState(false);

  // Rutas de los subitems de cada acordeón
  const productsRoutes = ['/productos', '/categorias', '/proveedores', '/marcas'];
  const posRoutes = ['/pos/new', '/pos/tablet'];
  const configRoutes = ['/usuarios', '/roles', '/configuracion', '/tasas-cambio'];
  const arRoutes = ['/cuentas-por-cobrar', '/cuentas-por-cobrar/clientes'];

  // Efecto para controlar el estado de los acordeones basado en la ruta actual
  useEffect(() => {
    const currentPath = location.pathname;

    // Verificar si la ruta actual pertenece a algún acordeón
    const isInProducts = productsRoutes.some(route => currentPath === route);
    const isInPOS = posRoutes.some(route => currentPath === route);
    const isInConfig = configRoutes.some(route => currentPath === route);
    const isInAR = arRoutes.some(route => currentPath.startsWith(route));

    // Actualizar estados
    setProductsOpen(isInProducts);
    setPosOpen(isInPOS);
    setConfigOpen(isInConfig);
    setArOpen(isInAR);
  }, [location.pathname]);

  const menuItems = [
    {
      name: 'Dashboard',
      icon: SquaresFour,
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
      icon: ArrowsLeftRight,
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
      permission: 'customers.view',
    },
    {
      name: 'Listas de Precios',
      icon: Receipt,
      path: '/listas-precios',
      permission: 'price_lists.view',
    },
    {
      name: 'Punto de Venta',
      icon: CreditCard,
      permission: 'sales.create',
      isAccordion: true,
      items: [
        {
          name: 'POS Desktop',
          path: '/pos/new',
          permission: 'sales.create',
        },
        {
          name: 'POS Tablet',
          path: '/pos/tablet',
          permission: 'sales.create',
        },
      ],
    },
    {
      name: 'Ventas',
      icon: ShoppingCart,
      path: '/ventas',
      permission: 'sales.view',
    },
    {
      name: 'Cotizaciones',
      icon: ReadCvLogo,
      path: '/cotizaciones',
      permission: 'sales.quotes.view',
    },
    {
      name: 'Pre-Pedidos',
      icon: Robot,
      path: '/pre-pedidos',
      permission: 'pre_orders.view',
    },
    {
      name: 'Compras',
      icon: ShoppingBag,
      path: '/purchase-orders',
      permission: 'purchases.view',
    },
    {
      name: 'Entregas',
      icon: Truck,
      path: '/deliveries',
      permission: 'deliveries.view',
    },
    {
      name: 'Notas de Crédito',
      icon: FileX,
      path: '/credit-notes',
      permission: 'credit_notes.view',
    },
    {
      name: 'Pagos a Proveedores',
      icon: Receipt,
      path: '/supplier-payments',
      permission: 'supplier_payments.view',
    },
    {
      name: 'Cuentas por Pagar',
      icon: ClipboardText,
      path: '/cuentas-por-pagar',
      permission: 'suppliers.view',
    },
    {
      name: 'Cuentas por Cobrar',
      icon: BookOpen,
      permission: 'ar.view',
      isAccordion: true,
      items: [
        {
          name: 'General',
          path: '/cuentas-por-cobrar',
          permission: 'ar.view',
        },
        {
          name: 'Por Cliente',
          path: '/cuentas-por-cobrar/clientes',
          permission: 'ar.view',
        },
      ],
    },
    {
      name: 'Reportes',
      icon: ChartBar,
      path: '/reportes',
      permission: 'reports.view',
    },
    {
      name: 'Cierre de Caja',
      icon: Calculator,
      path: '/cierre-caja',
      permission: 'sales.view', // Can be refined later
    },
    {
      name: 'Configuración',
      icon: Shield,
      permission: 'settings.manage',
      isAccordion: true,
      items: [
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
      const isPOSAccordion = item.name === 'Punto de Venta';
      const isARAccordion = item.name === 'Cuentas por Cobrar';
      const isOpen = isProductsAccordion ? productsOpen
        : isPOSAccordion ? posOpen
        : isARAccordion ? arOpen
        : configOpen;
      const toggleOpen = isProductsAccordion
        ? () => setProductsOpen(!productsOpen)
        : isPOSAccordion
          ? () => setPosOpen(!posOpen)
          : isARAccordion
            ? () => setArOpen(!arOpen)
            : () => setConfigOpen(!configOpen);

      return (
        <div key={`${item.name.toLowerCase()}-accordion`} className="space-y-1">
          <button
            onClick={toggleOpen}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isOpen
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
          >
            <div className="flex items-center">
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </div>
            {isOpen ? (
              <CaretDown className="h-4 w-4" />
            ) : (
              <CaretRight className="h-4 w-4" />
            )}
          </button>

          {isOpen && (
            <div className="ml-8 space-y-1">
              {visibleSubItems.map((subItem) => (
                <NavLink
                  key={subItem.path}
                  to={subItem.path}
                  end={true}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 text-sm rounded-lg transition-colors ${isActive
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
          `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
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
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
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
          <nav className="flex-1 px-4 pt-4 pb-4 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => renderMenuItem(item))}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
