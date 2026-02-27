-- Sistema de Gestión Integral para Negocio de Víveres
-- Database Schema — Estado actual sincronizado con modelos Sequelize
-- Última actualización: 2026-02-23
-- NOTA: Este archivo refleja el estado REAL de la base de datos después de todas las migraciones.
--       Para instalación nueva, ejecutar este archivo + los scripts de seeds/.
--       Migrations aplicadas documentadas al final del archivo.

SET FOREIGN_KEY_CHECKS = 0;

-- ========================================
-- MÓDULO DE ADMINISTRACIÓN
-- ========================================

CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  last_login TIMESTAMP NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_role_permission (role_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- MÓDULO DE INVENTARIO
-- ========================================

CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6B7280' COMMENT 'Color hex para identificación visual',
  parent_id INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id),
  INDEX idx_code (code),
  INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brands (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  logo_url VARCHAR(255),
  website VARCHAR(255),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOTA: brand, manufacturer, unit_of_measure, tax_rate eliminados.
-- Reemplazados por brand_id (FK), unit_size/unit_size_measure a nivel de producto.
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id INT NOT NULL,
  brand_id INT NULL,
  is_perishable BOOLEAN DEFAULT FALSE,
  has_batch_control BOOLEAN DEFAULT FALSE,
  min_stock INT NOT NULL DEFAULT 0,
  max_stock INT NOT NULL DEFAULT 0,
  reorder_point INT NOT NULL DEFAULT 0,
  unit_size DECIMAL(10,2) NULL COMMENT 'Tamaño de la unidad individual (ej: 500 para 500ml)',
  unit_size_measure VARCHAR(20) NULL DEFAULT 'UND' COMMENT 'Medida: UND, LT, ML, KG, GR, OZ, etc.',
  image_url VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_sku (sku),
  INDEX idx_name (name),
  INDEX idx_category_id (category_id),
  INDEX idx_brand_id (brand_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS packaging_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE COMMENT 'Bandeja, Caja, Fardo, Paquete, Bulto, Unidad',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS presentation_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE COMMENT 'Botella, Bolsa, Lata, Caja, Envase Plástico, Vidrio, Tetra Pak',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- unit_size y unit_size_measure se movieron a products (migración 20251226000001)
CREATE TABLE IF NOT EXISTS product_presentations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  packaging_type_id INT NULL,
  presentation_type_id INT NULL,
  name VARCHAR(100) NOT NULL COMMENT 'Ej: Bandeja de 6 botellas de 2L',
  units_per_package INT NOT NULL DEFAULT 1 COMMENT 'Cantidad de unidades por empaque',
  units_per_presentation DECIMAL(10,2) NOT NULL COMMENT 'Cantidad de unidades base por presentación',
  package_price DECIMAL(18,2) NULL COMMENT 'Precio del empaque completo',
  package_cost DECIMAL(18,2) NULL COMMENT 'Costo del empaque completo',
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Precio unitario base de venta',
  cost DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Costo unitario base',
  purchase_currency ENUM('USD', 'COP', 'VES') NOT NULL DEFAULT 'USD',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (packaging_type_id) REFERENCES packaging_types(id) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (presentation_type_id) REFERENCES presentation_types(id) ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS barcodes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  presentation_id INT NULL,
  barcode VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'EAN13' COMMENT 'EAN13, EAN8, UPC, CODE128, etc.',
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (presentation_id) REFERENCES product_presentations(id) ON DELETE SET NULL,
  INDEX idx_barcode (barcode),
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Venezuela',
  phone VARCHAR(20),
  manager_id INT NULL,
  is_main BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id),
  INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  reserved_quantity DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Cantidad reservada en ventas pendientes',
  last_count_date TIMESTAMP NULL COMMENT 'Última vez que se realizó conteo físico',
  last_movement_date TIMESTAMP NULL COMMENT 'Último movimiento de inventario',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  UNIQUE KEY unique_product_warehouse (product_id, warehouse_id),
  INDEX idx_product_id (product_id),
  INDEX idx_warehouse_id (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  batch_number VARCHAR(50) NOT NULL,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  manufacturing_date DATE,
  expiration_date DATE,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Costo unitario del lote',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  UNIQUE KEY unique_batch (batch_number, product_id, warehouse_id),
  INDEX idx_expiration_date (expiration_date),
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  presentation_id INT NULL,
  movement_type ENUM('ingreso','egreso','ajuste_positivo','ajuste_negativo','transferencia') NOT NULL,
  package_quantity DECIMAL(10,2) NULL,
  loose_units DECIMAL(10,2) DEFAULT 0,
  quantity DECIMAL(10,2) NOT NULL COMMENT 'Total en unidades base',
  unit_cost DECIMAL(10,2) NULL,
  package_cost DECIMAL(10,2) NULL,
  currency ENUM('USD','COP','VES') DEFAULT 'USD',
  reason TEXT,
  document_number VARCHAR(50) NULL COMMENT 'Número de documento de origen',
  batch_id INT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (presentation_id) REFERENCES product_presentations(id) ON DELETE SET NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_product_id (product_id),
  INDEX idx_warehouse_id (warehouse_id),
  INDEX idx_movement_type (movement_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transfer_number VARCHAR(50) NOT NULL UNIQUE,
  origin_warehouse_id INT NOT NULL,
  destination_warehouse_id INT NOT NULL,
  transfer_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending','in_transit','completed','cancelled') DEFAULT 'pending',
  notes TEXT,
  requested_by INT NOT NULL,
  approved_by INT NULL,
  shipped_by INT NULL,
  received_by INT NULL,
  approval_date DATE NULL,
  ship_date DATE NULL,
  received_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (origin_warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (shipped_by) REFERENCES users(id),
  FOREIGN KEY (received_by) REFERENCES users(id),
  INDEX idx_transfer_number (transfer_number),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- presentation_id y package_quantity/loose_units agregados (migración 20251225000002)
CREATE TABLE IF NOT EXISTS transfer_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transfer_id INT NOT NULL,
  product_id INT NOT NULL,
  batch_id INT NULL,
  presentation_id INT NULL,
  package_quantity INT NULL DEFAULT 0,
  loose_units INT DEFAULT 0,
  quantity_requested DECIMAL(10,2) NOT NULL,
  quantity_shipped DECIMAL(10,2) DEFAULT 0,
  quantity_received DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (transfer_id) REFERENCES transfers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (presentation_id) REFERENCES product_presentations(id) ON DELETE SET NULL,
  INDEX idx_transfer_id (transfer_id),
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- MÓDULO FINANCIERO
-- ========================================

CREATE TABLE IF NOT EXISTS exchange_rates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  from_currency ENUM('USD','COP','VES') NOT NULL,
  to_currency ENUM('USD','COP','VES') NOT NULL,
  rate DECIMAL(18,6) NOT NULL,
  effective_date DATE NOT NULL,
  source VARCHAR(100) NULL COMMENT 'Fuente de la tasa (manual, BCV, etc.)',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  UNIQUE KEY unique_rate_date (from_currency, to_currency, effective_date),
  INDEX idx_effective_date (effective_date),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- MÓDULO DE VENTAS
-- ========================================

CREATE TABLE IF NOT EXISTS price_lists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Auto-generado: LP-####',
  name VARCHAR(100) NOT NULL,
  description TEXT,
  currency ENUM('USD','COP','VES','PEN') NOT NULL DEFAULT 'PEN',
  base_percentage DECIMAL(5,2) DEFAULT 0 COMMENT '% ajuste sobre costo base',
  is_default BOOLEAN DEFAULT FALSE,
  status ENUM('active','inactive') DEFAULT 'active',
  valid_from DATE NULL,
  valid_until DATE NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Auto-generado: CLI-#####',
  type ENUM('natural','juridical') NOT NULL DEFAULT 'natural',
  document_type ENUM('DNI','RUC','CE','PASSPORT','OTHER') NOT NULL DEFAULT 'DNI',
  document_number VARCHAR(20) NOT NULL UNIQUE,
  business_name VARCHAR(200) NULL COMMENT 'Razón social (personas jurídicas)',
  trade_name VARCHAR(200) NULL COMMENT 'Nombre comercial',
  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  email VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  mobile VARCHAR(20) NULL,
  address TEXT NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  country VARCHAR(100) DEFAULT 'Perú',
  postal_code VARCHAR(10) NULL,
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Límite de crédito',
  credit_used DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Crédito actualmente usado',
  credit_days INT NOT NULL DEFAULT 0 COMMENT 'Días de crédito permitidos',
  price_list_id INT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL,
  INDEX idx_code (code),
  INDEX idx_status (status),
  INDEX idx_document_number (document_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Auto-generado: COT-YYYY-#####',
  customer_id INT NOT NULL,
  price_list_id INT NULL,
  user_id INT NOT NULL,
  quote_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  valid_until DATE NOT NULL,
  status ENUM('draft','sent','approved','rejected','converted','expired') DEFAULT 'draft',
  currency ENUM('USD','COP','VES','PEN') DEFAULT 'PEN',
  exchange_rate DECIMAL(12,4) DEFAULT 1,
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 18,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  payment_terms VARCHAR(200) NULL,
  delivery_terms TEXT NULL,
  notes TEXT NULL,
  internal_notes TEXT NULL,
  converted_to_sale_id INT NULL,
  converted_at DATE NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_code (code),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quote_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quote_id INT NOT NULL,
  product_id INT NOT NULL,
  product_presentation_id INT NULL,
  description TEXT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 18,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  notes TEXT NULL,
  line_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (product_presentation_id) REFERENCES product_presentations(id) ON DELETE SET NULL,
  INDEX idx_quote_id (quote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 'delivered' agregado en migración 20260223000003
CREATE TABLE IF NOT EXISTS sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id INT NULL,
  warehouse_id INT NOT NULL,
  user_id INT NOT NULL,
  sale_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sale_type ENUM('cash','credit') NOT NULL DEFAULT 'cash',
  payment_method ENUM('cash','card','transfer','mixed') NULL,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  change_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('pending','completed','cancelled','returned','delivered') NOT NULL DEFAULT 'pending',
  notes TEXT,
  quote_id INT NULL,
  created_by INT NOT NULL,
  updated_by INT NULL,
  deleted_at TIMESTAMP NULL COMMENT 'Soft delete via Sequelize paranoid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (quote_id) REFERENCES quotes(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_sale_number (sale_number),
  INDEX idx_customer_id (customer_id),
  INDEX idx_warehouse_id (warehouse_id),
  INDEX idx_sale_date (sale_date),
  INDEX idx_status (status),
  INDEX idx_sale_type (sale_type),
  INDEX idx_quote_id (quote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  presentation_id INT NOT NULL,
  batch_id INT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 16,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL,
  total DECIMAL(15,2) NOT NULL,
  cost_price DECIMAL(15,2) NULL COMMENT 'Costo para análisis de rentabilidad',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (presentation_id) REFERENCES product_presentations(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  INDEX idx_sale_id (sale_id),
  INDEX idx_product_id (product_id),
  INDEX idx_presentation_id (presentation_id),
  INDEX idx_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- bank_id intencional sin FK (tabla banks no implementada aún)
CREATE TABLE IF NOT EXISTS sale_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method ENUM('cash','card','transfer','check','other') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reference VARCHAR(100) NULL,
  bank_id INT NULL COMMENT 'Sin FK — tabla banks pendiente de implementación',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_sale_id (sale_id),
  INDEX idx_payment_date (payment_date),
  INDEX idx_payment_method (payment_method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  credit_note_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'NC-YYYYMMDD-####',
  sale_id INT NOT NULL,
  customer_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  credit_note_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  reason ENUM('return','discount','error','other') NOT NULL,
  reason_description TEXT NULL,
  type ENUM('full','partial') NOT NULL DEFAULT 'partial',
  status ENUM('draft','approved','applied','cancelled') NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  refund_method ENUM('cash','transfer','credit_balance','none') NOT NULL DEFAULT 'none',
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  refund_reference VARCHAR(100) NULL,
  notes TEXT NULL,
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_credit_note_number (credit_note_number),
  INDEX idx_sale_id (sale_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status),
  INDEX idx_credit_note_date (credit_note_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_note_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  credit_note_id INT NOT NULL,
  sale_detail_id INT NOT NULL,
  product_id INT NOT NULL,
  presentation_id INT NOT NULL,
  batch_id INT NULL,
  package_quantity_returned INT NOT NULL DEFAULT 0,
  loose_units_returned INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  return_to_stock BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_detail_id) REFERENCES sale_details(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (presentation_id) REFERENCES product_presentations(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  INDEX idx_credit_note_id (credit_note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deliveries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  delivery_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'ENT-YYYYMMDD-####',
  sale_id INT NOT NULL,
  customer_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  delivery_date DATE NULL,
  scheduled_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  delivery_address TEXT NOT NULL,
  delivery_city VARCHAR(100) NULL,
  delivery_state VARCHAR(100) NULL,
  contact_name VARCHAR(200) NULL,
  contact_phone VARCHAR(20) NULL,
  status ENUM('pending','in_transit','delivered','failed','cancelled') NOT NULL DEFAULT 'pending',
  delivery_method ENUM('pickup','courier','own_fleet','shipping_company') NOT NULL DEFAULT 'courier',
  tracking_number VARCHAR(100) NULL,
  carrier VARCHAR(100) NULL,
  notes TEXT NULL,
  delivered_by INT NULL,
  delivered_at TIMESTAMP NULL,
  signature_image_url VARCHAR(500) NULL COMMENT 'URL de foto de firma (uso futuro)',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (delivered_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_delivery_number (delivery_number),
  INDEX idx_sale_id (sale_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  delivery_id INT NOT NULL,
  sale_detail_id INT NOT NULL,
  product_id INT NOT NULL,
  presentation_id INT NOT NULL,
  package_quantity_delivered INT NOT NULL DEFAULT 0,
  loose_units_delivered INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_detail_id) REFERENCES sale_details(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (presentation_id) REFERENCES product_presentations(id),
  INDEX idx_delivery_id (delivery_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- MÓDULO DE COMPRAS
-- ========================================

CREATE TABLE IF NOT EXISTS suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  tax_id VARCHAR(50) NULL COMMENT 'RIF, NIT, RUC, etc.',
  payment_terms VARCHAR(100) NULL COMMENT 'Términos de pago acordados',
  notes TEXT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  position VARCHAR(100) NULL,
  email VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  mobile VARCHAR(20) NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_supplier_primary (supplier_id, is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'OC-YYYYMMDD-####',
  supplier_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  order_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  expected_delivery_date DATE NULL,
  delivery_date DATE NULL,
  status ENUM('draft','sent','confirmed','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
  currency ENUM('USD','COP','VES') NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by INT NOT NULL,
  updated_by INT NULL,
  approved_by INT NULL,
  approved_at DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_order_number (order_number),
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_warehouse_id (warehouse_id),
  INDEX idx_status (status),
  INDEX idx_order_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  product_id INT NOT NULL,
  presentation_id INT NOT NULL,
  package_quantity INT NOT NULL DEFAULT 0,
  loose_units INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  package_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  received_package_quantity INT NOT NULL DEFAULT 0,
  received_loose_units INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (presentation_id) REFERENCES product_presentations(id),
  INDEX idx_purchase_order_id (purchase_order_id),
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- invoice_number y status agregados en migración 20260223000002
-- bank_id intencional sin FK (tabla banks pendiente)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  payment_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'PP-YYYYMMDD-####',
  supplier_id INT NOT NULL,
  purchase_order_id INT NULL,
  payment_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  payment_method ENUM('cash','transfer','check','card','other') NOT NULL DEFAULT 'transfer',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency ENUM('USD','COP','VES') NOT NULL DEFAULT 'USD',
  reference VARCHAR(100) NULL COMMENT 'Número de cheque, referencia de transferencia',
  invoice_number VARCHAR(100) NULL COMMENT 'Número de factura del proveedor',
  status ENUM('recorded','confirmed','cancelled') NOT NULL DEFAULT 'recorded',
  bank_id INT NULL COMMENT 'Sin FK — tabla banks pendiente de implementación',
  notes TEXT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_supplier_id (supplier_id),
  INDEX idx_purchase_order_id (purchase_order_id),
  INDEX idx_payment_date (payment_date),
  INDEX idx_payment_number (payment_number),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- MIGRACIONES APLICADAS (historial)
-- ========================================
-- 20251222224055  create-exchange-rates
-- 20251223000001  remove-unit-of-measure-from-products
-- 20251223042913  update-products-structure
--                   - Elimina: brand, manufacturer, tax_rate de products
--                   - Agrega: brand_id FK, packaging_types, presentation_types
--                   - Modifica: min_stock/max_stock/reorder_point a INTEGER
--                   - Agrega a product_presentations: packaging_type_id, presentation_type_id,
--                     units_per_package, unit_size, unit_size_measure, package_price, package_cost
-- 20251223044615  add-image-and-purchase-currency
-- 20251224000001  add-color-to-categories
-- 20251225000001  create-inventory-movements
-- 20251225000002  add-presentation-to-transfer-details
-- 20251225120000  change-transfer-quantities-to-integer
-- 20251226000001  move-unit-size-to-products
--                   - Mueve unit_size/unit_size_measure de product_presentations → products
-- 20260223000001  add-credit-used-to-customers
-- 20260223000002  add-fields-to-supplier-payments (invoice_number, status)
-- 20260223000003  add-delivered-status-to-sales (ENUM +delivered)
-- ========================================
-- CAMPOS PENDIENTES DE IMPLEMENTACIÓN FUTURA
-- ========================================
-- bank_id en sale_payments y supplier_payments requieren tabla `banks`
-- signature_image_url en deliveries (verificación digital de entrega)
-- last_count_date / last_movement_date en inventory (conteo físico)
