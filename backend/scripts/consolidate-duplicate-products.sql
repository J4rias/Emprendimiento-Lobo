-- ============================================================
-- CONSOLIDACIÓN DE PRODUCTOS DUPLICADOS
-- 41 productos duplicados (3 triplicados), generado 2026-06-24
--
-- Estrategia:
--   A) Presentaciones CON match (mismo units_per_package):
--      reasignar FKs del viejo al nuevo, eliminar presentación vieja
--   B) Presentaciones SIN match (distinto units_per_package):
--      mover presentación vieja al producto nuevo (preserva FKs)
--   C) Producto viejo sin presentaciones: solo eliminar producto
--
-- Mapeo old_product → new_product:
--   206→676, 826→1142, 17→1103, 16→1176, 639→1062, 25→1070,
--   552→1151, 1040→1117, 1041→1118, 217→1106, 218→1107, 42→1008,
--   883→956, 110→1129, 601→1188, 813→1101, 814→1102, 675→1137,
--   664→1124, 890→1171, 891→1165, 801→1164, 1170→1164, 84→1194,
--   976→1104, 247→1120, 116→1135, 193→1155, 1015→1155, 1014→1154,
--   132→1189, 961→1143, 584→1139, 991→1145, 808→1166, 1034→1114,
--   807→1163, 184→989, 527→993, 148→1002, 525→973
-- ============================================================

-- ============================================================
-- PASO 1: Reasignar sale_details.presentation_id (CON match)
-- ============================================================
UPDATE sale_details SET presentation_id = 502  WHERE presentation_id = 222;  -- Aceite Ideal Soya
UPDATE sale_details SET presentation_id = 968  WHERE presentation_id = 652;  -- Agua Nevada
UPDATE sale_details SET presentation_id = 929  WHERE presentation_id = 33;   -- Arroz Favorito
UPDATE sale_details SET presentation_id = 1003 WHERE presentation_id = 32;   -- Arroz Mary Dorado
UPDATE sale_details SET presentation_id = 896  WHERE presentation_id = 41;   -- Avena Quaker
UPDATE sale_details SET presentation_id = 977  WHERE presentation_id = 374;  -- Azucar Montalban
UPDATE sale_details SET presentation_id = 943  WHERE presentation_id = 866;  -- Cafe Alvarigua 200
UPDATE sale_details SET presentation_id = 944  WHERE presentation_id = 867;  -- Cafe Alvarigua 500
UPDATE sale_details SET presentation_id = 834  WHERE presentation_id = 58;   -- Cafe Brasil 400
UPDATE sale_details SET presentation_id = 782  WHERE presentation_id = 709;  -- Cafe Fruto Santo
UPDATE sale_details SET presentation_id = 955  WHERE presentation_id = 126;  -- Condensada Natulac
UPDATE sale_details SET presentation_id = 1014 WHERE presentation_id = 425;  -- Crema Arroz Mary
UPDATE sale_details SET presentation_id = 927  WHERE presentation_id = 639;  -- Crema Arroz Primor 450
UPDATE sale_details SET presentation_id = 928  WHERE presentation_id = 640;  -- Crema Arroz Primor 900
UPDATE sale_details SET presentation_id = 963  WHERE presentation_id = 501;  -- Crema Leche Nestle
UPDATE sale_details SET presentation_id = 950  WHERE presentation_id = 489;  -- Det. Ariel
UPDATE sale_details SET presentation_id = 997  WHERE presentation_id = 716;  -- Det. Bona Delicadas
UPDATE sale_details SET presentation_id = 991  WHERE presentation_id = 717;  -- Det. Bona Oscuras
UPDATE sale_details SET presentation_id = 990  WHERE presentation_id = 627;  -- Det. Bona Ropa (de 801)
UPDATE sale_details SET presentation_id = 990  WHERE presentation_id = 996;  -- Det. Bona Ropa (de 1170)
UPDATE sale_details SET presentation_id = 1020 WHERE presentation_id = 100;  -- Harina Pan
UPDATE sale_details SET presentation_id = 930  WHERE presentation_id = 802;  -- Huevo Chocolate
UPDATE sale_details SET presentation_id = 961  WHERE presentation_id = 132;  -- Leche Campesina
UPDATE sale_details SET presentation_id = 1015 WHERE presentation_id = 148;  -- Mayonesa Mavesa
UPDATE sale_details SET presentation_id = 969  WHERE presentation_id = 787;  -- Mayonesa Sofia
UPDATE sale_details SET presentation_id = 941  WHERE presentation_id = 336;  -- Rikesa
UPDATE sale_details SET presentation_id = 971  WHERE presentation_id = 817;  -- Salsa Pampero 3.6
UPDATE sale_details SET presentation_id = 992  WHERE presentation_id = 634;  -- Salsa Zev
UPDATE sale_details SET presentation_id = 940  WHERE presentation_id = 860;  -- Servilleta Arbora
UPDATE sale_details SET presentation_id = 815  WHERE presentation_id = 200;  -- Toddy
UPDATE sale_details SET presentation_id = 819  WHERE presentation_id = 344;  -- Vinagre
UPDATE sale_details SET presentation_id = 828  WHERE presentation_id = 164;  -- Pasticho Sindoni

-- ============================================================
-- PASO 2: Reasignar sale_details.product_id (TODOS los viejos)
-- ============================================================
UPDATE sale_details SET product_id = 676  WHERE product_id = 206;
UPDATE sale_details SET product_id = 1142 WHERE product_id = 826;
UPDATE sale_details SET product_id = 1103 WHERE product_id = 17;
UPDATE sale_details SET product_id = 1176 WHERE product_id = 16;
UPDATE sale_details SET product_id = 1062 WHERE product_id = 639;
UPDATE sale_details SET product_id = 1070 WHERE product_id = 25;
UPDATE sale_details SET product_id = 1151 WHERE product_id = 552;
UPDATE sale_details SET product_id = 1117 WHERE product_id = 1040;
UPDATE sale_details SET product_id = 1118 WHERE product_id = 1041;
UPDATE sale_details SET product_id = 1106 WHERE product_id = 217;
UPDATE sale_details SET product_id = 1107 WHERE product_id = 218;
UPDATE sale_details SET product_id = 1008 WHERE product_id = 42;
UPDATE sale_details SET product_id = 956  WHERE product_id = 883;
UPDATE sale_details SET product_id = 1129 WHERE product_id = 110;
UPDATE sale_details SET product_id = 1188 WHERE product_id = 601;
UPDATE sale_details SET product_id = 1101 WHERE product_id = 813;
UPDATE sale_details SET product_id = 1102 WHERE product_id = 814;
UPDATE sale_details SET product_id = 1137 WHERE product_id = 675;
UPDATE sale_details SET product_id = 1124 WHERE product_id = 664;
UPDATE sale_details SET product_id = 1171 WHERE product_id = 890;
UPDATE sale_details SET product_id = 1165 WHERE product_id = 891;
UPDATE sale_details SET product_id = 1164 WHERE product_id = 801;
UPDATE sale_details SET product_id = 1164 WHERE product_id = 1170;
UPDATE sale_details SET product_id = 1194 WHERE product_id = 84;
UPDATE sale_details SET product_id = 1104 WHERE product_id = 976;
UPDATE sale_details SET product_id = 1120 WHERE product_id = 247;
UPDATE sale_details SET product_id = 1135 WHERE product_id = 116;
UPDATE sale_details SET product_id = 1155 WHERE product_id = 193;
UPDATE sale_details SET product_id = 1155 WHERE product_id = 1015;
UPDATE sale_details SET product_id = 1154 WHERE product_id = 1014;
UPDATE sale_details SET product_id = 1189 WHERE product_id = 132;
UPDATE sale_details SET product_id = 1143 WHERE product_id = 961;
UPDATE sale_details SET product_id = 1139 WHERE product_id = 584;
UPDATE sale_details SET product_id = 1145 WHERE product_id = 991;
UPDATE sale_details SET product_id = 1166 WHERE product_id = 808;
UPDATE sale_details SET product_id = 1114 WHERE product_id = 1034;
UPDATE sale_details SET product_id = 1163 WHERE product_id = 807;
UPDATE sale_details SET product_id = 989  WHERE product_id = 184;
UPDATE sale_details SET product_id = 993  WHERE product_id = 527;
UPDATE sale_details SET product_id = 1002 WHERE product_id = 148;
UPDATE sale_details SET product_id = 973  WHERE product_id = 525;
UPDATE sale_details SET product_id = 1115 WHERE product_id = 523;

-- ============================================================
-- PASO 3: Reasignar credit_note_details (presentation_id + product_id)
-- ============================================================
UPDATE credit_note_details SET presentation_id = 1020 WHERE presentation_id = 100;
UPDATE credit_note_details SET presentation_id = 955  WHERE presentation_id = 126;
UPDATE credit_note_details SET presentation_id = 1015 WHERE presentation_id = 148;
UPDATE credit_note_details SET presentation_id = 930  WHERE presentation_id = 802;
UPDATE credit_note_details SET presentation_id = 990  WHERE presentation_id = 996;
-- product_id
UPDATE credit_note_details SET product_id = 1194 WHERE product_id = 84;
UPDATE credit_note_details SET product_id = 1129 WHERE product_id = 110;
UPDATE credit_note_details SET product_id = 1189 WHERE product_id = 132;
UPDATE credit_note_details SET product_id = 1104 WHERE product_id = 976;
UPDATE credit_note_details SET product_id = 1164 WHERE product_id = 1170;

-- ============================================================
-- PASO 4: Reasignar purchase_order_details (presentation_id + product_id)
-- ============================================================
UPDATE purchase_order_details SET presentation_id = 1020 WHERE presentation_id = 100;
UPDATE purchase_order_details SET presentation_id = 961  WHERE presentation_id = 132;
UPDATE purchase_order_details SET presentation_id = 1015 WHERE presentation_id = 148;
UPDATE purchase_order_details SET presentation_id = 828  WHERE presentation_id = 164;
UPDATE purchase_order_details SET presentation_id = 1014 WHERE presentation_id = 425;
-- product_id
UPDATE purchase_order_details SET product_id = 1194 WHERE product_id = 84;
UPDATE purchase_order_details SET product_id = 1135 WHERE product_id = 116;
UPDATE purchase_order_details SET product_id = 1189 WHERE product_id = 132;
UPDATE purchase_order_details SET product_id = 1002 WHERE product_id = 148;
UPDATE purchase_order_details SET product_id = 1188 WHERE product_id = 601;

-- ============================================================
-- PASO 5: Reasignar inventory_movements (presentation_id + product_id)
-- ============================================================
UPDATE inventory_movements SET presentation_id = 502,  product_id = 676  WHERE presentation_id = 222;
UPDATE inventory_movements SET presentation_id = 929,  product_id = 1103 WHERE presentation_id = 33;
UPDATE inventory_movements SET presentation_id = 977,  product_id = 1151 WHERE presentation_id = 374;
UPDATE inventory_movements SET presentation_id = 834,  product_id = 1008 WHERE presentation_id = 58;
UPDATE inventory_movements SET presentation_id = 955,  product_id = 1129 WHERE presentation_id = 126;
UPDATE inventory_movements SET presentation_id = 927,  product_id = 1101 WHERE presentation_id = 639;
UPDATE inventory_movements SET presentation_id = 928,  product_id = 1102 WHERE presentation_id = 640;
UPDATE inventory_movements SET presentation_id = 950,  product_id = 1124 WHERE presentation_id = 489;
UPDATE inventory_movements SET presentation_id = 997,  product_id = 1171 WHERE presentation_id = 716;
UPDATE inventory_movements SET presentation_id = 991,  product_id = 1165 WHERE presentation_id = 717;
UPDATE inventory_movements SET presentation_id = 990,  product_id = 1164 WHERE presentation_id = 627;
UPDATE inventory_movements SET presentation_id = 990,  product_id = 1164 WHERE presentation_id = 996;
UPDATE inventory_movements SET presentation_id = 1020, product_id = 1194 WHERE presentation_id = 100;
UPDATE inventory_movements SET presentation_id = 930,  product_id = 1104 WHERE presentation_id = 802;
UPDATE inventory_movements SET presentation_id = 961,  product_id = 1135 WHERE presentation_id = 132;
UPDATE inventory_movements SET presentation_id = 1015, product_id = 1189 WHERE presentation_id = 148;
UPDATE inventory_movements SET presentation_id = 969,  product_id = 1143 WHERE presentation_id = 787;
UPDATE inventory_movements SET presentation_id = 941,  product_id = 1115 WHERE presentation_id = 336;
UPDATE inventory_movements SET presentation_id = 992,  product_id = 1166 WHERE presentation_id = 634;
UPDATE inventory_movements SET presentation_id = 940,  product_id = 1114 WHERE presentation_id = 860;
UPDATE inventory_movements SET presentation_id = 815,  product_id = 989  WHERE presentation_id = 200;
UPDATE inventory_movements SET presentation_id = 819,  product_id = 993  WHERE presentation_id = 344;
UPDATE inventory_movements SET presentation_id = 828,  product_id = 1002 WHERE presentation_id = 164;
-- Presentaciones SIN match (solo actualizar product_id, pp se mueve en paso 7)
UPDATE inventory_movements SET product_id = 1106 WHERE presentation_id = 387;
UPDATE inventory_movements SET product_id = 1107 WHERE presentation_id = 386;
UPDATE inventory_movements SET product_id = 1120 WHERE presentation_id = 263;
UPDATE inventory_movements SET product_id = 1155 WHERE presentation_id = 209;
UPDATE inventory_movements SET product_id = 1155 WHERE presentation_id = 841;
UPDATE inventory_movements SET product_id = 1154 WHERE presentation_id = 840;
UPDATE inventory_movements SET product_id = 1163 WHERE presentation_id = 633;
-- Limpiar cualquier inventory_movement restante de productos viejos
UPDATE inventory_movements SET product_id = 676  WHERE product_id = 206;
UPDATE inventory_movements SET product_id = 1142 WHERE product_id = 826;
UPDATE inventory_movements SET product_id = 1103 WHERE product_id = 17;
UPDATE inventory_movements SET product_id = 1176 WHERE product_id = 16;
UPDATE inventory_movements SET product_id = 1062 WHERE product_id = 639;
UPDATE inventory_movements SET product_id = 1070 WHERE product_id = 25;
UPDATE inventory_movements SET product_id = 1151 WHERE product_id = 552;
UPDATE inventory_movements SET product_id = 1117 WHERE product_id = 1040;
UPDATE inventory_movements SET product_id = 1118 WHERE product_id = 1041;
UPDATE inventory_movements SET product_id = 1008 WHERE product_id = 42;
UPDATE inventory_movements SET product_id = 956  WHERE product_id = 883;
UPDATE inventory_movements SET product_id = 1188 WHERE product_id = 601;
UPDATE inventory_movements SET product_id = 1137 WHERE product_id = 675;
UPDATE inventory_movements SET product_id = 1124 WHERE product_id = 664;
UPDATE inventory_movements SET product_id = 1171 WHERE product_id = 890;
UPDATE inventory_movements SET product_id = 1165 WHERE product_id = 891;
UPDATE inventory_movements SET product_id = 1164 WHERE product_id = 801;
UPDATE inventory_movements SET product_id = 1164 WHERE product_id = 1170;
UPDATE inventory_movements SET product_id = 1194 WHERE product_id = 84;
UPDATE inventory_movements SET product_id = 1104 WHERE product_id = 976;
UPDATE inventory_movements SET product_id = 1135 WHERE product_id = 116;
UPDATE inventory_movements SET product_id = 1189 WHERE product_id = 132;
UPDATE inventory_movements SET product_id = 1143 WHERE product_id = 961;
UPDATE inventory_movements SET product_id = 1139 WHERE product_id = 584;
UPDATE inventory_movements SET product_id = 1145 WHERE product_id = 991;
UPDATE inventory_movements SET product_id = 1166 WHERE product_id = 808;
UPDATE inventory_movements SET product_id = 1114 WHERE product_id = 1034;
UPDATE inventory_movements SET product_id = 1163 WHERE product_id = 807;
UPDATE inventory_movements SET product_id = 989  WHERE product_id = 184;
UPDATE inventory_movements SET product_id = 993  WHERE product_id = 527;
UPDATE inventory_movements SET product_id = 1002 WHERE product_id = 148;
UPDATE inventory_movements SET product_id = 973  WHERE product_id = 525;
UPDATE inventory_movements SET product_id = 1115 WHERE product_id = 523;

-- ============================================================
-- PASO 6: Mover barcodes al producto nuevo
-- ============================================================
UPDATE barcodes SET product_id = 676  WHERE product_id = 206;
UPDATE barcodes SET product_id = 1142 WHERE product_id = 826;
UPDATE barcodes SET product_id = 1103 WHERE product_id = 17;
UPDATE barcodes SET product_id = 1176 WHERE product_id = 16;
UPDATE barcodes SET product_id = 1062 WHERE product_id = 639;
UPDATE barcodes SET product_id = 1070 WHERE product_id = 25;
UPDATE barcodes SET product_id = 1151 WHERE product_id = 552;
UPDATE barcodes SET product_id = 1117 WHERE product_id = 1040;
UPDATE barcodes SET product_id = 1118 WHERE product_id = 1041;
UPDATE barcodes SET product_id = 1106 WHERE product_id = 217;
UPDATE barcodes SET product_id = 1107 WHERE product_id = 218;
UPDATE barcodes SET product_id = 1008 WHERE product_id = 42;
UPDATE barcodes SET product_id = 956  WHERE product_id = 883;
UPDATE barcodes SET product_id = 1129 WHERE product_id = 110;
UPDATE barcodes SET product_id = 1188 WHERE product_id = 601;
UPDATE barcodes SET product_id = 1101 WHERE product_id = 813;
UPDATE barcodes SET product_id = 1102 WHERE product_id = 814;
UPDATE barcodes SET product_id = 1137 WHERE product_id = 675;
UPDATE barcodes SET product_id = 1124 WHERE product_id = 664;
UPDATE barcodes SET product_id = 1171 WHERE product_id = 890;
UPDATE barcodes SET product_id = 1165 WHERE product_id = 891;
UPDATE barcodes SET product_id = 1164 WHERE product_id = 801;
UPDATE barcodes SET product_id = 1164 WHERE product_id = 1170;
UPDATE barcodes SET product_id = 1194 WHERE product_id = 84;
UPDATE barcodes SET product_id = 1104 WHERE product_id = 976;
UPDATE barcodes SET product_id = 1120 WHERE product_id = 247;
UPDATE barcodes SET product_id = 1135 WHERE product_id = 116;
UPDATE barcodes SET product_id = 1155 WHERE product_id = 193;
UPDATE barcodes SET product_id = 1155 WHERE product_id = 1015;
UPDATE barcodes SET product_id = 1154 WHERE product_id = 1014;
UPDATE barcodes SET product_id = 1189 WHERE product_id = 132;
UPDATE barcodes SET product_id = 1143 WHERE product_id = 961;
UPDATE barcodes SET product_id = 1139 WHERE product_id = 584;
UPDATE barcodes SET product_id = 1145 WHERE product_id = 991;
UPDATE barcodes SET product_id = 1166 WHERE product_id = 808;
UPDATE barcodes SET product_id = 1114 WHERE product_id = 1034;
UPDATE barcodes SET product_id = 1163 WHERE product_id = 807;
UPDATE barcodes SET product_id = 989  WHERE product_id = 184;
UPDATE barcodes SET product_id = 993  WHERE product_id = 527;
UPDATE barcodes SET product_id = 1002 WHERE product_id = 148;
UPDATE barcodes SET product_id = 973  WHERE product_id = 525;
UPDATE barcodes SET product_id = 1115 WHERE product_id = 523;

-- ============================================================
-- PASO 7: Mover presentaciones SIN match al producto nuevo
-- ============================================================
UPDATE product_presentations SET product_id = 1106 WHERE id = 387;  -- Cafe Aroma 125gr (25 UND)
UPDATE product_presentations SET product_id = 1107 WHERE id = 386;  -- Cafe Aroma 250gr (24 UND)
UPDATE product_presentations SET product_id = 1120 WHERE id = 263;  -- Leche Induleche (16 UND)
UPDATE product_presentations SET product_id = 1155 WHERE id = 209;  -- Maizina 200gr (40 UND)
UPDATE product_presentations SET product_id = 1155 WHERE id = 841;  -- Maizina 200gr (40 UND, de 1015)
UPDATE product_presentations SET product_id = 1154 WHERE id = 840;  -- Maizina 90gr (50 UND)
UPDATE product_presentations SET product_id = 1139 WHERE id = 408;  -- Papel Rendy (16 UND)
UPDATE product_presentations SET product_id = 1163 WHERE id = 633;  -- Suavizante Bona (14 UND)
UPDATE product_presentations SET product_id = 973  WHERE id = 342;  -- Salsas Mixtas (24 UND)

-- ============================================================
-- PASO 8: Eliminar price_list_details de presentaciones reasignadas
-- ============================================================
DELETE FROM price_list_details WHERE presentation_id IN (
  222, 652, 33, 32, 41, 374, 866, 867, 58, 709, 126, 425,
  639, 640, 501, 489, 716, 717, 627, 996, 100, 802,
  132, 148, 787, 336, 817, 634, 860, 200, 344, 164
);

-- ============================================================
-- PASO 9: Eliminar presentaciones reasignadas
-- ============================================================
DELETE FROM product_presentations WHERE id IN (
  222, 652, 33, 32, 41, 374, 866, 867, 58, 709, 126, 425,
  639, 640, 501, 489, 716, 717, 627, 996, 100, 802,
  132, 148, 787, 336, 817, 634, 860, 200, 344, 164
);

-- ============================================================
-- PASO 10: Limpiar datos restantes de productos viejos y eliminarlos
-- ============================================================
DELETE FROM inventory WHERE product_id IN (
  206, 826, 17, 16, 639, 25, 552, 1040, 1041, 217, 218, 42, 883,
  110, 601, 813, 814, 675, 664, 890, 891, 801, 1170, 84, 976,
  247, 116, 193, 1015, 1014, 132, 961, 584, 523, 991, 808, 1034,
  807, 184, 527, 148, 525
);

DELETE FROM price_list_details WHERE product_id IN (
  206, 826, 17, 16, 639, 25, 552, 1040, 1041, 217, 218, 42, 883,
  110, 601, 813, 814, 675, 664, 890, 891, 801, 1170, 84, 976,
  247, 116, 193, 1015, 1014, 132, 961, 584, 523, 991, 808, 1034,
  807, 184, 527, 148, 525
);

DELETE FROM inventory_movements WHERE product_id IN (
  206, 826, 17, 16, 639, 25, 552, 1040, 1041, 217, 218, 42, 883,
  110, 601, 813, 814, 675, 664, 890, 891, 801, 1170, 84, 976,
  247, 116, 193, 1015, 1014, 132, 961, 584, 523, 991, 808, 1034,
  807, 184, 527, 148, 525
);

DELETE FROM product_presentations WHERE product_id IN (
  206, 826, 17, 16, 639, 25, 552, 1040, 1041, 217, 218, 42, 883,
  110, 601, 813, 814, 675, 664, 890, 891, 801, 1170, 84, 976,
  247, 116, 193, 1015, 1014, 132, 961, 584, 523, 991, 808, 1034,
  807, 184, 527, 148, 525
);

DELETE FROM products WHERE id IN (
  206, 826, 17, 16, 639, 25, 552, 1040, 1041, 217, 218, 42, 883,
  110, 601, 813, 814, 675, 664, 890, 891, 801, 1170, 84, 976,
  247, 116, 193, 1015, 1014, 132, 961, 584, 523, 991, 808, 1034,
  807, 184, 527, 148, 525
);

-- ============================================================
-- VERIFICACIÓN: debe retornar 0 filas
-- ============================================================
SELECT p.name, COUNT(*) as cnt
FROM products p
GROUP BY p.name
HAVING COUNT(*) > 1;
