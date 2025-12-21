-- Seed: Roles y Permisos Iniciales
-- Created: 2025-01-20

-- ========================================
-- ROLES
-- ========================================

INSERT INTO roles (name, description) VALUES
('Administrador', 'Acceso total al sistema'),
('Despachador', 'Gestión de inventario y despachos'),
('Cajero', 'Punto de venta y cobros'),
('Contador', 'Reportes financieros y facturación');

-- ========================================
-- PERMISOS - MÓDULO DE PRODUCTOS
-- ========================================

INSERT INTO permissions (name, description, module, action) VALUES
('products.view', 'Ver productos', 'products', 'view'),
('products.create', 'Crear productos', 'products', 'create'),
('products.update', 'Actualizar productos', 'products', 'update'),
('products.delete', 'Eliminar productos', 'products', 'delete');

-- ========================================
-- PERMISOS - MÓDULO DE INVENTARIO
-- ========================================

INSERT INTO permissions (name, description, module, action) VALUES
('inventory.view', 'Ver inventario', 'inventory', 'view'),
('inventory.adjust', 'Ajustar inventario', 'inventory', 'adjust'),
('inventory.transfer', 'Realizar traslados', 'inventory', 'transfer'),
('inventory.receive', 'Recibir traslados', 'inventory', 'receive');

-- ========================================
-- PERMISOS - MÓDULO DE VENTAS
-- ========================================

INSERT INTO permissions (name, description, module, action) VALUES
('sales.view', 'Ver ventas', 'sales', 'view'),
('sales.create', 'Crear ventas', 'sales', 'create'),
('sales.cancel', 'Cancelar ventas', 'sales', 'cancel'),
('sales.return', 'Procesar devoluciones', 'sales', 'return');

-- ========================================
-- PERMISOS - MÓDULO DE COMPRAS
-- ========================================

INSERT INTO permissions (name, description, module, action) VALUES
('purchases.view', 'Ver compras', 'purchases', 'view'),
('purchases.create', 'Crear órdenes de compra', 'purchases', 'create'),
('purchases.approve', 'Aprobar órdenes de compra', 'purchases', 'approve'),
('purchases.receive', 'Recibir compras', 'purchases', 'receive');

-- ========================================
-- PERMISOS - MÓDULO DE REPORTES
-- ========================================

INSERT INTO permissions (name, description, module, action) VALUES
('reports.view', 'Ver reportes', 'reports', 'view'),
('reports.export', 'Exportar reportes', 'reports', 'export'),
('reports.financial', 'Ver reportes financieros', 'reports', 'financial');

-- ========================================
-- PERMISOS - MÓDULO DE ADMINISTRACIÓN
-- ========================================

INSERT INTO permissions (name, description, module, action) VALUES
('users.view', 'Ver usuarios', 'users', 'view'),
('users.create', 'Crear usuarios', 'users', 'create'),
('users.update', 'Actualizar usuarios', 'users', 'update'),
('users.delete', 'Eliminar usuarios', 'users', 'delete'),
('roles.manage', 'Gestionar roles y permisos', 'roles', 'manage'),
('settings.manage', 'Gestionar configuraciones', 'settings', 'manage');

-- ========================================
-- ASIGNACIÓN DE PERMISOS A ROLES
-- ========================================

-- Administrador: Todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Despachador: Inventario y traslados
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name IN (
  'products.view',
  'inventory.view',
  'inventory.adjust',
  'inventory.transfer',
  'inventory.receive',
  'purchases.view',
  'purchases.receive',
  'reports.view'
);

-- Cajero: Ventas y productos básico
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name IN (
  'products.view',
  'inventory.view',
  'sales.view',
  'sales.create',
  'sales.return',
  'reports.view'
);

-- Contador: Reportes y facturación
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions WHERE name IN (
  'products.view',
  'inventory.view',
  'sales.view',
  'purchases.view',
  'reports.view',
  'reports.export',
  'reports.financial'
);
