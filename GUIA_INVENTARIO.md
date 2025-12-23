# 📦 Guía del Sistema de Inventario

## ¿Cómo Funciona el Inventario?

El sistema de inventario gestiona el stock de productos en diferentes depósitos/almacenes. Aquí está el flujo completo:

### 1. **Estructura del Inventario**

```
Producto → Inventario por Depósito → Stock Disponible
```

- **Producto**: Artículo que vendes (ej: Arroz Diana 500g)
- **Depósito**: Ubicación física donde guardas productos (ej: Almacén Principal, Sucursal 1)
- **Inventario**: Cantidad de cada producto en cada depósito

### 2. **Flujo de Trabajo**

#### **Paso 1: Crear Productos**
1. Ve a **Productos** → Click en **"Nuevo Producto"**
2. Completa la información:
   - Nombre del producto
   - Categoría
   - SKU (código único)
   - Unidad de medida
   - Stock mínimo (punto de reorden)

#### **Paso 2: Registrar Inventario Inicial**
El inventario se crea automáticamente cuando:
- Creas un producto nuevo
- Realizas una transferencia entre depósitos
- Ajustas el stock manualmente

#### **Paso 3: Ver el Inventario**
En la página de **Inventario** puedes:
- Ver stock actual por depósito
- Filtrar por productos con stock bajo
- Buscar productos específicos
- Ver el valor total del inventario

### 3. **Estados del Inventario**

| Estado | Descripción | Color |
|--------|-------------|-------|
| **Normal** | Stock por encima del punto de reorden | 🟢 Verde |
| **Stock Bajo** | Stock igual o menor al punto de reorden | 🟡 Amarillo |
| **Agotado** | Sin stock disponible | 🔴 Rojo |

### 4. **Operaciones Principales**

#### **Ajustar Stock**
Para aumentar o disminuir el inventario:
1. Selecciona el producto en el inventario
2. Click en el ícono de edición (✏️)
3. Elige:
   - **Agregar**: Entrada de mercancía (compras, devoluciones)
   - **Remover**: Salida de mercancía (daños, pérdidas)
4. Indica la razón del ajuste

#### **Transferencias entre Depósitos**
1. Ve a **Transferencias**
2. Selecciona depósito origen y destino
3. Agrega productos y cantidades
4. Confirma la transferencia

#### **Ventas**
Cuando realizas una venta en el **POS**:
- El stock se reduce automáticamente
- Se actualiza el inventario del depósito
- Se registra el movimiento

### 5. **Alertas y Notificaciones**

El sistema te avisa cuando:
- ✅ **Stock Bajo**: Productos que necesitan reabastecimiento
- ⏰ **Próximos a Vencer**: Productos perecederos cercanos a su fecha de vencimiento
- 💰 **Valoración**: Valor total del inventario en dinero

### 6. **Reportes Disponibles**

- **Valor del Inventario**: Cuánto dinero tienes invertido en stock
- **Productos con Stock Bajo**: Lista de productos a reabastecer
- **Productos por Vencer**: Control de fechas de vencimiento
- **Movimientos**: Historial de entradas y salidas

## 🎯 Casos de Uso Comunes

### Caso 1: Recibir Mercancía Nueva
```
1. Ir a Inventario
2. Buscar el producto
3. Click en "Ajustar Stock"
4. Tipo: "Agregar"
5. Cantidad: 100
6. Razón: "Compra a proveedor XYZ"
7. Guardar
```

### Caso 2: Producto Dañado
```
1. Ir a Inventario
2. Buscar el producto
3. Click en "Ajustar Stock"
4. Tipo: "Remover"
5. Cantidad: 5
6. Razón: "Producto dañado en transporte"
7. Guardar
```

### Caso 3: Mover Stock entre Depósitos
```
1. Ir a Transferencias
2. Origen: Almacén Principal
3. Destino: Sucursal 1
4. Agregar productos
5. Confirmar transferencia
```

## 📊 Métricas Importantes

- **Stock Actual**: Cantidad física disponible
- **Stock Mínimo**: Nivel de reorden configurado
- **Stock Disponible**: Stock actual - reservas
- **Valor Total**: Suma del costo de todos los productos

## ⚙️ Configuración Recomendada

1. **Define puntos de reorden**: Establece el stock mínimo para cada producto
2. **Organiza por categorías**: Facilita la búsqueda y filtrado
3. **Usa SKUs únicos**: Evita confusiones con códigos claros
4. **Revisa regularmente**: Haz conteos físicos periódicos

## 🔍 Solución de Problemas

### "No veo productos en el inventario"
- Verifica que los productos estén creados
- Asegúrate de que tengan inventario registrado en el depósito seleccionado
- Revisa los filtros aplicados

### "El stock no se actualiza después de una venta"
- Verifica que la venta se haya completado correctamente
- Revisa que el depósito de la venta coincida con el que estás viendo

### "Valor del inventario en $0.00"
- Asegúrate de que los productos tengan precio de costo configurado
- Verifica que haya stock disponible

## 📱 Accesos Rápidos

- **Dashboard** → Ver resumen general
- **Inventario** → Gestionar stock por depósito
- **Productos** → Crear y editar productos
- **Transferencias** → Mover stock entre depósitos
- **POS** → Realizar ventas (reduce inventario automáticamente)
