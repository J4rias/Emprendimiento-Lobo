-- Migration: Pagos Multi-Factura con Tasa Congelada
-- Fecha: 2026-03-04
-- Descripción: Crear tabla supplier_payment_allocations y añadir campos de tasa a supplier_payments

-- 1. Nuevos campos en supplier_payments para tasa de cambio personalizada
ALTER TABLE supplier_payments
  ADD COLUMN exchange_rate DECIMAL(12,6) NULL COMMENT 'Tasa de cambio usada en el pago',
  ADD COLUMN exchange_rate_from VARCHAR(3) NULL COMMENT 'Moneda origen de la tasa (USD, COP, VES)',
  ADD COLUMN exchange_rate_to VARCHAR(3) NULL COMMENT 'Moneda destino de la tasa (USD, COP, VES)';

-- 2. Tabla de adjudicaciones (un pago -> muchas OCs)
CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  purchase_order_id INT NOT NULL,
  invoice_number VARCHAR(100) NULL COMMENT 'Factura del proveedor',
  allocated_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Monto en moneda del pago',
  allocated_amount_po_currency DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Monto equivalente en moneda de la OC (congelado)',
  exchange_rate_used DECIMAL(12,6) NULL COMMENT 'Tasa usada para esta conversión (congelada)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES supplier_payments(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  INDEX idx_spa_payment (payment_id),
  INDEX idx_spa_purchase_order (purchase_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Migrar pagos existentes que tienen purchase_order_id a la nueva tabla
INSERT INTO supplier_payment_allocations (payment_id, purchase_order_id, invoice_number, allocated_amount, allocated_amount_po_currency, exchange_rate_used)
SELECT
  sp.id,
  sp.purchase_order_id,
  sp.invoice_number,
  sp.amount,
  sp.amount,
  1.000000
FROM supplier_payments sp
WHERE sp.purchase_order_id IS NOT NULL
  AND sp.status != 'cancelled';
