-- Seed: Datos de Ejemplo
-- Created: 2025-01-20

-- ========================================
-- CATEGORÍAS
-- ========================================

INSERT INTO categories (code, name, description) VALUES
('LAC', 'Lácteos', 'Productos lácteos y derivados'),
('GRA', 'Granos', 'Granos, legumbres y cereales'),
('ACE', 'Aceites', 'Aceites comestibles'),
('BEB', 'Bebidas', 'Bebidas no alcohólicas'),
('ENL', 'Enlatados', 'Productos enlatados y conservas'),
('LIM', 'Limpieza', 'Productos de limpieza'),
('HIG', 'Higiene', 'Productos de higiene personal'),
('CHU', 'Chucherías', 'Dulces y golosinas'),
('PAN', 'Panadería', 'Productos de panadería'),
('CAR', 'Carnes', 'Carnes y embutidos');

-- ========================================
-- DEPÓSITOS
-- ========================================

INSERT INTO warehouses (code, name, description, city, state, is_main) VALUES
('MAIN', 'Depósito Principal', 'Almacén principal de distribución', 'Caracas', 'Miranda', TRUE),
('SUC01', 'Sucursal 1', 'Punto de venta sucursal 1', 'Caracas', 'Miranda', FALSE),
('SUC02', 'Sucursal 2', 'Punto de venta sucursal 2', 'Maracay', 'Aragua', FALSE);

-- ========================================
-- PRODUCTOS DE EJEMPLO
-- ========================================

-- Nota: Estos productos se crearán desde la aplicación
-- para que el sistema genere correctamente los SKU
-- Este seed es solo de referencia

-- Lácteos
-- VIV-LAC-0001: Leche Entera 1L
-- VIV-LAC-0002: Queso Blanco 500g
-- VIV-LAC-0003: Mantequilla 250g

-- Granos
-- VIV-GRA-0001: Arroz Blanco 1Kg
-- VIV-GRA-0002: Frijoles Negros 500g
-- VIV-GRA-0003: Pasta Espagueti 500g

-- Aceites
-- VIV-ACE-0001: Aceite de Girasol 1L
-- VIV-ACE-0002: Aceite de Oliva 500ml

-- Bebidas
-- VIV-BEB-0001: Refresco Cola 2L
-- VIV-BEB-0002: Agua Mineral 1.5L
-- VIV-BEB-0003: Jugo Naranja 1L
