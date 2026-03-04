-- Migración para añadir exchange_rate a la tabla sales
-- Esto congela la tasa de cambio al momento de la venta para que los montos históricos en COP no varíen.

-- 1. Agregar la columna (por defecto 1.0000)
ALTER TABLE sales 
ADD COLUMN exchange_rate DECIMAL(18, 6) NOT NULL DEFAULT 1.0000 
COMMENT 'Tasa de cambio (USD a COP) al momento de la venta';

-- 2. Recuperar la tasa de cambio de los pagos asociados a las ventas (si existen)
UPDATE sales s
JOIN sale_payments sp ON s.id = sp.sale_id
SET s.exchange_rate = sp.exchange_rate;

-- 3. Para las ventas que no tienen pago (crédito) o que no se les actualizó,
-- buscar la tasa de cambio de la tabla exchange_rates que estaba activa en ese día
UPDATE sales s
JOIN (
    SELECT DATE(created_at) as rate_date, MAX(rate) as rate
    FROM exchange_rates
    -- Podríamos coger la última del día si hay varias, esto asume una por día (usamos MAX para evitar full group by)
    GROUP BY DATE(created_at)
) er ON DATE(s.sale_date) = er.rate_date
SET s.exchange_rate = er.rate
WHERE s.exchange_rate = 1.0000;

-- 4. Si aún quedan ventas en 1.0000 (porque son viejas y no había registro ese día), 
-- actualizar con la tasa actual (o puedes especificar una manual aquí)
UPDATE sales s
JOIN (
    SELECT rate FROM exchange_rates ORDER BY created_at DESC LIMIT 1
) latest_rate
SET s.exchange_rate = latest_rate.rate
WHERE s.exchange_rate = 1.0000;
