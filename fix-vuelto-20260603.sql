-- Fix: Restar vuelto/cambio de SalePayments del 2026-06-03
-- Los montos se registraron brutos (incluyendo vuelto dado al cliente)
-- Esta corrección deja solo el monto neto que quedó en caja

START TRANSACTION;

UPDATE sale_payments SET amount = 7000 WHERE id = 6611;       -- VEN-20260603-0007: 10000 -> 7000 (vuelto 3000)
UPDATE sale_payments SET amount = 176000 WHERE id = 6613;     -- VEN-20260603-0009: 177000 -> 176000 (vuelto 1000)
UPDATE sale_payments SET amount = 5600 WHERE id = 6614;       -- VEN-20260603-0010: 7000 -> 5600 (vuelto 1400)
UPDATE sale_payments SET amount = 185000 WHERE id = 6616;     -- VEN-20260603-0015: 200000 -> 185000 (vuelto 15000)
UPDATE sale_payments SET amount = 823500 WHERE id = 6622;     -- VEN-20260603-0019: 850000 -> 823500 (vuelto 26500)
UPDATE sale_payments SET amount = 68000 WHERE id = 6624;      -- VEN-20260603-0021: 100000 -> 68000 (vuelto 32000)
UPDATE sale_payments SET amount = 523500 WHERE id = 6625;     -- VEN-20260603-0022: 525000 -> 523500 (vuelto 1500)
UPDATE sale_payments SET amount = 60000 WHERE id = 6628;      -- VEN-20260603-0024: 70000 -> 60000 (vuelto 10000)
UPDATE sale_payments SET amount = 33000 WHERE id = 6629;      -- VEN-20260603-0025: 50000 -> 33000 (vuelto 17000)

COMMIT;

-- Total vuelto corregido: 107,400 COP
