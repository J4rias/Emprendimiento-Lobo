-- Migración: Agregar columna is_unit a sale_details
-- Fecha: 2026-03-07
-- Descripción: Permite diferenciar si un item se vendió por unidad suelta (true) o por bulto/empaque (false)

ALTER TABLE sale_details 
ADD COLUMN is_unit BOOLEAN NOT NULL DEFAULT FALSE 
COMMENT 'Indica si la venta se hizo por unidad (true) o por bulto/empaque (false)';

-- Nota: Esta columna es crítica para el cálculo correcto del inventario al cancelar ventas
-- y para la visualización correcta en los tickets de POS.
