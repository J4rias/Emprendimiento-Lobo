-- =============================================================================
-- Script de corrección: inventario inflado por bug en devoluciones is_unit
-- =============================================================================
-- PROBLEMA: approveCreditNote multiplicaba package_quantity_returned * units_per_package
-- incluso para items vendidos por unidad (is_unit=1), donde debía multiplicar por 1.
-- Esto infló el inventario en (pkg_ret * uph - pkg_ret) unidades por cada devolución.
--
-- FECHA: 2026-06-15
-- AFECTADOS: 29 productos, 29 notas de crédito, 5163 unidades de exceso
-- =============================================================================

-- Verificar ANTES de aplicar: exceso por producto
SELECT cnd.product_id, p.name, pp.units_per_package AS uph,
       SUM(cnd.package_quantity_returned) AS units_returned_correct,
       SUM(cnd.package_quantity_returned * pp.units_per_package) AS units_added_wrong,
       SUM(cnd.package_quantity_returned * pp.units_per_package - cnd.package_quantity_returned) AS excess,
       i.quantity AS stock_actual,
       i.quantity - SUM(cnd.package_quantity_returned * pp.units_per_package - cnd.package_quantity_returned) AS stock_corrected
FROM credit_note_details cnd
JOIN credit_notes cn ON cn.id = cnd.credit_note_id
JOIN sale_details sd ON sd.id = cnd.sale_detail_id
JOIN product_presentations pp ON pp.id = cnd.presentation_id
JOIN products p ON p.id = cnd.product_id
JOIN inventory i ON i.product_id = cnd.product_id
WHERE cn.status = 'applied' AND sd.is_unit = 1 AND pp.units_per_package > 1
GROUP BY cnd.product_id, p.name, pp.units_per_package, i.quantity
ORDER BY excess DESC;

-- =============================================================================
-- CORRECCIÓN 1: Restar exceso del inventario
-- =============================================================================
UPDATE inventory i
JOIN (
    SELECT cnd.product_id,
           SUM(cnd.package_quantity_returned * pp.units_per_package - cnd.package_quantity_returned) AS excess
    FROM credit_note_details cnd
    JOIN credit_notes cn ON cn.id = cnd.credit_note_id
    JOIN sale_details sd ON sd.id = cnd.sale_detail_id
    JOIN product_presentations pp ON pp.id = cnd.presentation_id
    WHERE cn.status = 'applied' AND sd.is_unit = 1 AND pp.units_per_package > 1
    GROUP BY cnd.product_id
) fix ON fix.product_id = i.product_id
SET i.quantity = i.quantity - fix.excess;

-- =============================================================================
-- CORRECCIÓN 2: Corregir cantidad en inventory_movements de las NC afectadas
-- (los movimientos de ingreso tienen quantity = pkg * uph, debería ser pkg * 1)
-- =============================================================================
-- Primero identificamos los movimientos afectados por timestamp de aprobación
-- Nota: no hay reference_id en inventory_movements, usamos product_id + timestamp de la NC
-- Esta corrección es opcional si solo necesitas el stock actual correcto.

-- =============================================================================
-- CORRECCIÓN 3: Actualizar refund_amount en notas de crédito cash con valor 0
-- =============================================================================
UPDATE credit_notes
SET refund_amount = total
WHERE refund_method = 'cash' AND refund_amount = 0 AND status = 'applied';

-- También para transfer
UPDATE credit_notes
SET refund_amount = total
WHERE refund_method = 'transfer' AND refund_amount = 0 AND status = 'applied';

-- =============================================================================
-- Verificar DESPUÉS de aplicar
-- =============================================================================
-- Ejecutar la misma query de verificación de arriba y confirmar stock_corrected = stock_actual
