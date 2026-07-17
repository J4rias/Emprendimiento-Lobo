import { NavLink, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  SquaresFour,
  Package,
  Scan,
  Warehouse,
  ShoppingCart,
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
  Shield,
  CaretDown,
  CaretRight,
  ArrowLineLeft,
  ArrowLineRight,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react';

// ─── Menu types ───────────────────────────────────────────────────────────────

interface MenuSubItem {
  name: string;
  path: string;
  permission: string;
}

interface MenuItemBase {
  name: string;
  icon: React.ComponentType<any>;
  permission: string;
  path?: string;
  end?: boolean;
  isAccordion?: false;
}

interface MenuItemAccordion {
  name: string;
  icon: React.ComponentType<any>;
  permission: string;
  isAccordion: true;
  items: MenuSubItem[];
}

type MenuItem = MenuItemBase | MenuItemAccordion;

interface MenuSection {
  section: string | null;
  items: MenuItem[];
}

interface TipState {
  x: number;
  y: number;
  label: string;
  subs?: string[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onCollapse: () => void;
}

// ─── Menu definition ──────────────────────────────────────────────────────────

const MENU: MenuSection[] = [
  {
    section: null,
    items: [
      { name: 'Dashboard', icon: SquaresFour, path: '/dashboard', permission: 'dashboard.view' },
    ],
  },
  {
    section: 'Inventario',
    items: [
      { name: 'Inventario',       icon: Package,               path: '/inventario',            permission: 'inventory.adjust',   end: true },
      { name: 'Movimientos',      icon: ClockCounterClockwise, path: '/inventario/movimientos', permission: 'inventory.adjust'   },
      { name: 'Reponer Stock',    icon: Scan,                  path: '/reponer-stock',          permission: 'inventory.adjust'   },
      { name: 'Transferencias',   icon: ArrowsLeftRight,       path: '/transferencias',         permission: 'inventory.transfer' },
      {
        name: 'Productos', icon: Warehouse, permission: 'products.create', isAccordion: true,
        items: [
          { name: 'Lista de Productos', path: '/productos',  permission: 'products.create' },
          { name: 'Categorías',         path: '/categorias', permission: 'products.create' },
          { name: 'Proveedores',        path: '/proveedores',permission: 'suppliers.view'  },
          { name: 'Marcas',             path: '/marcas',     permission: 'products.create' },
        ],
      },
    ],
  },
  {
    section: 'Ventas',
    items: [
      { name: 'Clientes',        icon: UserCheck,   path: '/clientes',       permission: 'customers.view'    },
      { name: 'Listas de Precios', icon: Receipt,   path: '/listas-precios', permission: 'price_lists.view'  },
      {
        name: 'Punto de Venta', icon: CreditCard, permission: 'sales.create', isAccordion: true,
        items: [
          { name: 'POS Desktop', path: '/pos/new',    permission: 'sales.create' },
          { name: 'POS Tablet',  path: '/pos/tablet', permission: 'sales.create' },
        ],
      },
      { name: 'Ventas',       icon: ShoppingCart, path: '/ventas',       permission: 'sales.view'        },
      { name: 'Cotizaciones', icon: ReadCvLogo,   path: '/cotizaciones', permission: 'sales.quotes.view' },
      { name: 'Pre-Pedidos',  icon: Robot,        path: '/pre-pedidos',  permission: 'pre_orders.view'   },
    ],
  },
  {
    section: 'Compras',
    items: [
      { name: 'Órdenes de Compra',     icon: ShoppingBag,   path: '/purchase-orders',  permission: 'purchases.view'         },
      { name: 'Entregas',              icon: Truck,         path: '/deliveries',       permission: 'deliveries.view'        },
      { name: 'Notas de Crédito',      icon: FileX,         path: '/credit-notes',     permission: 'credit_notes.view'      },
      { name: 'Pagos a Proveedores',   icon: Receipt,       path: '/supplier-payments',permission: 'supplier_payments.view' },
      { name: 'Cuentas por Pagar',     icon: ClipboardText, path: '/cuentas-por-pagar',permission: 'suppliers.view'         },
    ],
  },
  {
    section: 'Finanzas',
    items: [
      {
        name: 'Cuentas por Cobrar', icon: BookOpen, permission: 'ar.view', isAccordion: true,
        items: [
          { name: 'General',     path: '/cuentas-por-cobrar',         permission: 'ar.view' },
          { name: 'Por Cliente', path: '/cuentas-por-cobrar/clientes',permission: 'ar.view' },
        ],
      },
      { name: 'Reportes',      icon: ChartBar,   path: '/reportes',    permission: 'reports.view' },
      { name: 'Cierre de Caja', icon: Calculator, path: '/cierre-caja', permission: 'sales.collect' },
    ],
  },
  {
    section: 'Sistema',
    items: [
      {
        name: 'Configuración', icon: Shield, permission: 'settings.manage', isAccordion: true,
        items: [
          { name: 'Configuración General', path: '/configuracion', permission: 'settings.manage' },
          { name: 'Tasas de Cambio',       path: '/tasas-cambio',  permission: 'settings.manage' },
        ],
      },
    ],
  },
];

// ─── Sidebar component ────────────────────────────────────────────────────────

const Sidebar = ({ isOpen, onClose, collapsed, onCollapse }: SidebarProps): React.JSX.Element => {
  const { hasPermission } = useAuth();
  const location = useLocation();

  // Set of accordion names that are currently open
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  // Portal tooltip state — shows to the right of any item when collapsed
  const [tip, setTip] = useState<TipState | null>(null);
  const showTip = (e: ReactMouseEvent, label: string, subs?: string[]): void => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.right + 8, y: r.top + r.height / 2, label, subs });
  };
  const hideTip = (): void => setTip(null);

  const toggleAccordion = (name: string): void => {
    setOpenAccordions(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  // Auto-open the accordion that contains the current route
  useEffect(() => {
    const path = location.pathname;
    const toOpen = new Set();
    MENU.forEach(({ items }) =>
      items.forEach(item => {
        if (item.isAccordion) {
          const active = item.items.some(sub => path === sub.path || path.startsWith(sub.path + '/'));
          if (active) toOpen.add(item.name);
        }
      })
    );
    setOpenAccordions(toOpen);
  }, [location.pathname]);

  // When collapsing, close all accordions (they'd be invisible anyway)
  // When expanding (e.g. from accordion click), clear any frozen tooltip
  useEffect(() => {
    if (collapsed) setOpenAccordions(new Set());
    setTip(null);
  }, [collapsed]);

  const can = (permission: string): boolean => !permission || hasPermission(permission);

  // ── Render a single nav item ────────────────────────────────────────────────
  const renderItem = (item: MenuItem): React.JSX.Element | null => {
    if (!can(item.permission)) return null;

    if (item.isAccordion) {
      const visibleSubs = item.items.filter(s => can(s.permission));
      if (visibleSubs.length === 0) return null;

      const isOpen = openAccordions.has(item.name);
      const isSubActive = visibleSubs.some(
        s => location.pathname === s.path || location.pathname.startsWith(s.path + '/')
      );

      return (
        <div key={item.name}>
          <button
            onClick={() => {
              if (collapsed) onCollapse();
              else toggleAccordion(item.name);
            }}
            onMouseEnter={collapsed ? (e) => showTip(e, item.name, visibleSubs.map(s => s.name)) : undefined}
            onMouseLeave={collapsed ? hideTip : undefined}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium
                       rounded-lg transition-colors ${
                         isOpen || isSubActive
                           ? 'bg-primary-50 text-primary-700'
                           : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                       }`}
          >
            <div className="flex items-center min-w-0">
              <item.icon size={20} className="shrink-0" />
              {!collapsed && (
                <span className="ml-3 truncate">{item.name}</span>
              )}
            </div>
            {!collapsed && (
              isOpen
                ? <CaretDown size={14} className="shrink-0 ml-1" />
                : <CaretRight size={14} className="shrink-0 ml-1" />
            )}
          </button>

          {/* Sub-items */}
          {!collapsed && isOpen && (
            <div className="mt-1 ml-7 pl-3 border-l border-gray-100 space-y-0.5">
              {visibleSubs.map(sub => (
                <NavLink
                  key={sub.path}
                  to={sub.path}
                  end
                  onClick={onClose}
                  className={({ isActive }) =>
                    `block px-3 py-2 text-sm rounded-lg transition-colors ${
                      isActive
                        ? 'text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {sub.name}
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
        end={item.end}
        onClick={onClose}
        onMouseEnter={collapsed ? (e) => showTip(e, item.name) : undefined}
        onMouseLeave={collapsed ? hideTip : undefined}
        className={({ isActive }) =>
          `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            isActive
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
          }`
        }
      >
        <item.icon size={20} className="shrink-0" />
        {!collapsed && <span className="ml-3 truncate">{item.name}</span>}
      </NavLink>
    );
  };

  // ── Render a section ────────────────────────────────────────────────────────
  const renderSection = ({ section, items }: MenuSection, idx: number): React.JSX.Element | null => {
    const visibleItems = items.map(renderItem).filter(Boolean);
    if (visibleItems.length === 0) return null;

    return (
      <div key={section ?? '__top'}>
        {/* Section divider */}
        {idx > 0 && (
          <div className={`mt-3 mb-2 ${collapsed ? 'mx-3 border-t border-gray-100' : 'mx-1'}`}>
            {!collapsed && section && (
              <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {section}
              </span>
            )}
            {collapsed && <div className="border-t border-gray-100" />}
          </div>
        )}
        <div className="space-y-0.5">{visibleItems}</div>
      </div>
    );
  };

  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 shadow-sm
                    flex flex-col overflow-hidden transition-all duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0 lg:static lg:inset-0
                    w-64 ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
      >
        {/* Header */}
        <div className={`flex items-center h-16 border-b border-gray-100 shrink-0 ${
          collapsed ? 'justify-center px-2' : 'px-4 justify-between'
        }`}>
          {!collapsed && (
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Navegación</span>
          )}
          {/* Collapse toggle — desktop only */}
          <button
            onClick={onCollapse}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg
                       text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <ArrowLineRight size={16} /> : <ArrowLineLeft size={16} />}
          </button>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg
                       text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto py-3 space-y-0 ${collapsed ? 'px-2' : 'px-3'}`}>
          {MENU.map((section, idx) => renderSection(section, idx))}
        </nav>
      </div>

      {/* Portal tooltip — renders in document.body, escapes all overflow constraints */}
      {collapsed && tip && createPortal(
        <div
          style={{ position: 'fixed', left: tip.x, top: tip.y, transform: 'translateY(-50%)', zIndex: 9999 }}
          className="pointer-events-none bg-gray-900 text-white text-xs rounded-md px-2.5 py-1.5 shadow-lg"
        >
          <div className="font-medium whitespace-nowrap">{tip.label}</div>
          {tip.subs?.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {tip.subs.map(s => (
                <div key={s} className="text-gray-400 whitespace-nowrap">{s}</div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default Sidebar;
