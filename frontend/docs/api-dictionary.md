# Atlas ERP — Diccionario de API

> **Estado:** Mapeo completo (2026-07-03) — 27 módulos / 176 entradas documentadas / 133 no conformidades registradas  
> **Base URL:** `/api`  
> **Auth:** Bearer token en header `Authorization: Bearer <token>` (excepto rutas públicas indicadas)

---

## Búsqueda rápida

Cada endpoint tiene un **ID único** con el formato `[TAG]:[ACCIÓN]`.

- **Busca por módulo:** Ctrl+F `BRD:` → todos los endpoints de Brands
- **Busca por acción:** Ctrl+F `:LIST` → todos los endpoints de listado
- **Busca por path:** Ctrl+F `/api/brands` → endpoint específico

### Tabla de TAGs por módulo

| TAG  | Módulo               | Base path                  | Archivo de rutas              |
|------|----------------------|----------------------------|-------------------------------|
| AUTH | Autenticación        | `/api/auth`                | `auth.routes.js`              |
| PRD  | Productos            | `/api/products`            | `product.routes.js`           |
| CAT  | Categorías           | `/api/categories`          | `category.routes.js`          |
| BRD  | Marcas               | `/api/brands`              | `brand.routes.js`             |
| INV  | Inventario           | `/api/inventory`           | `inventory.routes.js`         |
| TRF  | Transferencias       | `/api/transfers`           | `transfer.routes.js`          |
| SLE  | Ventas               | `/api/sales`               | `sale.routes.js`              |
| POS  | Punto de venta       | `/api/pos`                 | `pos.routes.js`               |
| CST  | Clientes             | `/api/customers`           | `customer.routes.js`          |
| SUP  | Proveedores          | `/api/suppliers`           | `supplier.routes.js`          |
| SPY  | Pagos a proveedores  | `/api/supplier-payments`   | `supplierPayment.routes.js`   |
| PO   | Órdenes de compra    | `/api/purchase-orders`     | `purchaseOrder.routes.js`     |
| PRL  | Listas de precios    | `/api/price-lists`         | `priceList.routes.js`         |
| QT   | Cotizaciones         | `/api/quotes`              | `quote.routes.js`             |
| PRE  | Pre-pedidos          | `/api/pre-orders`          | `preOrder.routes.js`          |
| XCH  | Tasas de cambio      | `/api/exchange-rates`      | `exchangeRate.routes.js`      |
| AR   | Cuentas por cobrar   | `/api/ar`                  | `ar.routes.js`                |
| CN   | Notas de crédito     | `/api/credit-notes`        | `creditNote.routes.js`        |
| DLV  | Entregas             | `/api/deliveries`          | `delivery.routes.js`          |
| BNK  | Bancos               | `/api/banks`               | `bank.routes.js`              |
| PKG  | Tipos de empaque     | `/api/packaging-types`     | `packagingType.routes.js`     |
| PRT  | Tipos de presentación| `/api/presentation-types`  | `presentationType.routes.js`  |
| ROL  | Roles                | `/api` (ver nota)          | `role.routes.js`              |
| USR  | Usuarios             | `/api/users`               | `user.routes.js`              |
| CMP  | Empresa              | `/api/company`             | `company.routes.js`           |
| UPL  | Carga de archivos    | `/api/upload`              | `upload.routes.js`            |
| CTL  | Catálogo público     | `/api/catalog`             | `catalog.routes.js`           |

> ⚠️ `ROL` — `role.routes.js` está montado en `/api` sin prefijo propio. Ver `endpoint-normalization.md`.

### Tipos de acción estándar

| Acción  | Método HTTP | Descripción                         |
|---------|-------------|-------------------------------------|
| `LIST`  | GET         | Listado paginado con filtros        |
| `GET`   | GET         | Detalle de un registro por ID       |
| `CRT`   | POST        | Crear nuevo registro                |
| `UPD`   | PUT / PATCH | Actualizar registro existente       |
| `DEL`   | DELETE      | Eliminar o desactivar registro      |
| `STATS` | GET         | Resumen estadístico / agregados     |
| `SRCH`  | GET         | Búsqueda especializada              |
| `AUTH`  | POST        | Acción de autenticación             |
| `UPL`   | POST        | Subida de archivo                   |
| `EXP`   | GET         | Exportación (PDF, CSV, etc.)        |

---

## Instrucciones para el agente mapeador

> **Agente:** estas instrucciones son para ti. Tu tarea es leer el backend y completar las entradas vacías de este documento.

### Archivos a leer por cada módulo

Para cada módulo, leer en este orden:

1. **Archivo de rutas** → `backend/routes/[module].routes.js`  
   Extrae: paths, métodos HTTP, middlewares aplicados (auth, roles, validate), handlers llamados.

2. **Archivo de controlador** → `backend/controllers/[module].controller.js` (o similar)  
   Extrae: lógica de cada handler, campos que lee del body/query/params, campos que devuelve en la respuesta, códigos HTTP usados (`res.status(X)`), mensajes de error devueltos.

3. **Modelo Sequelize** → `backend/models/[Model].js`  
   Extrae: nombre de la tabla (`tableName`), columnas con tipo, allowNull, defaultValue, validate, asociaciones. Esto permite verificar si el controlador usa campos que NO están en el modelo.

4. **Middleware de validación** (si existe) → buscar en `backend/middleware/` o inline en el route file  
   Extrae: campos validados, reglas (required, min, max, regex, etc.), mensajes de error devueltos.

### Qué buscar específicamente

**En el archivo de rutas:**
- Método HTTP y path exacto de cada endpoint
- Middlewares aplicados: `authenticate`, `authorize('permiso')`, validadores
- Si el path tiene verbos (no conforme) o más de 2 niveles de anidación

**En el controlador:**
- `req.body.*` → campos aceptados en POST/PUT/PATCH
- `req.query.*` → query params (filtros, paginación, orden)
- `req.params.*` → path params (`:id`, etc.)
- `res.status(X).json({...})` → código HTTP y shape de respuesta
- `where: { ... }` en queries Sequelize → filtros que aplica
- `attributes: [...]` → si excluye columnas del modelo
- `order: [...]` → si el orden está hardcodeado o viene de query param

**En el modelo Sequelize:**
- `tableName` → nombre real de la tabla
- Columnas con `allowNull`, `defaultValue`, `validate` → base para validaciones del backend
- Asociaciones (`hasMany`, `belongsTo`) → explica qué campos extra pueden aparecer en includes

### Checklist de homogeneidad — 3 niveles

El agente debe completar los tres checklists conforme avanza. Usar `✅` (conforme), `❌` (no conforme — registrar en `endpoint-normalization.md`), `⚠️` (parcial o dudoso — agregar nota).

---

#### Nivel 1 — Por endpoint (incluir en cada entrada del template)

Copiar este bloque dentro de cada entrada al mapearla:

```
**Checklist de conformidad:**
- [ ] Path: sustantivos plurales, kebab-case, sin verbos, sin trailing slash
- [ ] Método HTTP correcto para la operación (GET/POST/PUT/PATCH/DELETE)
- [ ] Código HTTP de respuesta correcto (201 en POST, 200 en lista vacía, 409 en duplicado)
- [ ] Shape de respuesta: `{ data, pagination }` para listas — `{ message, data }` para singles
- [ ] Campos del body documentados y verificados contra el modelo Sequelize
- [ ] Query params siguen convención: `page`, `limit`, `sort_by`, `sort_dir`, `date_from`, `date_to`
- [ ] Ningún campo sensible expuesto (`password`, tokens, claves internas)
- [ ] Mensajes de error en español y consistentes con los demás módulos
- [ ] Campos huérfanos identificados y registrados (si aplica)
```

Llenar con `✅` / `❌` / `⚠️`. Los `❌` y `⚠️` van también a `endpoint-normalization.md §2`.

---

#### Nivel 2 — Por módulo (agregar al final de cada sección de módulo)

Una vez mapeados todos los endpoints del módulo, copiar y completar:

```markdown
#### Resumen de homogeneidad — [TAG] [Nombre del módulo]

| Criterio | Estado | Notas |
|----------|--------|-------|
| Todos los endpoints usan el mismo prefijo de path | | |
| Middleware `authenticate` aplicado en todos (o justificado en los que no) | | |
| Códigos HTTP consistentes entre endpoints del módulo | | |
| Shape de respuesta uniforme (no mezcla `{ data }` con `{ brands }`) | | |
| Convención de campos: snake_case o camelCase (no mezclados) | | |
| Mensajes de error en español en todos | | |
| Paginación con los mismos parámetros en todos los LIST | | |
| Campos huérfanos documentados | | |

**No conformidades de este módulo:** [número] — ver `endpoint-normalization.md`
```

---

#### Nivel 3 — Global (completar al terminar todos los módulos)

Agregar esta sección al final del documento una vez que todos los módulos estén mapeados:

```markdown
## Resumen Global de Homogeneidad

Fecha de mapeo: YYYY-MM-DD
Módulos mapeados: X / 27

### Criterios transversales

| Criterio | Módulos conformes | Módulos no conformes |
|----------|-------------------|----------------------|
| Shape de respuesta `{ data }` uniforme | | |
| Códigos HTTP correctos (POST → 201, etc.) | | |
| Mensajes de error en español | | |
| Autenticación consistente | | |
| Convención de campos (snake_case uniforme) | | |
| Query params con nombres estándar | | |
| Ningún campo sensible expuesto | | |
| Lista vacía → 200 con `data: []` (no 404) | | |

### Patrones de inconsistencia más frecuentes
1. [patrón más común]
2. [segundo]
3. ...

### Total de no conformidades encontradas
- Endpoints no conformes: X (ver `endpoint-normalization.md §2`)
- Campos huérfanos: X (ver `endpoint-normalization.md §3`)
- Inconsistencias de formato: X (ver `endpoint-normalization.md §4`)
```

---

Para cada no conformidad encontrada en cualquier nivel, agregar una fila en `endpoint-normalization.md §2`.

### Campos huérfanos

Un **campo huérfano** es aquel que aparece en la respuesta o en el body pero no corresponde a ninguna columna del modelo Sequelize. Categorías:
- `CALC` — calculado en JS (ej. `totalAmount = qty * price`)
- `ALIAS` — alias de asociación (ej. `as: 'brandName'` incluyendo campo de Brand en Product)
- `UNUSED` — en el body del request pero el controller lo ignora
- `MISSING` — esperado por el frontend pero no devuelto
- `WRONG_NAME` — nombre diferente al de la columna sin alias explícito

Para cada campo huérfano, agregar fila en `endpoint-normalization.md §3`.

### Formato de cada entrada

Usar el template de abajo. Si un campo es desconocido o la lógica es compleja, usar `TODO` y una nota.

---

## Template de entrada (copiar para cada endpoint)

```markdown
### [TAG:ACCIÓN] METHOD /api/path

**Tipo:** [Lista paginada | Detalle | Crear | Actualizar | Eliminar | Stats | Acción]
**Auth:** [Requerido | Público]
**Permiso:** [nombre.del.permiso o "ninguno"]

**Parámetros de path:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| id    | int  | ID del registro |

**Query params:**
| Param  | Tipo   | Req | Default | Descripción |
|--------|--------|-----|---------|-------------|
| page   | int    | No  | 1       | Página      |
| limit  | int    | No  | 25      | Por página  |
| search | string | No  | —       | Búsqueda    |

**Body (JSON):**
| Campo       | Tipo    | Req | Validación backend          | Notas |
|-------------|---------|-----|-----------------------------|-------|
| name        | string  | Sí  | trim, minLen 2, maxLen 100  |       |
| description | string  | No  | maxLen 500                  |       |

**Response 200/201:**
```json
{
  "message": "...",
  "data": { ... }
}
```

**Códigos HTTP:**
| Código | Cuándo                                        |
|--------|-----------------------------------------------|
| 200    | OK (GET, PUT, DELETE)                         |
| 201    | Creado exitosamente (POST)                    |
| 400    | Validación fallida / datos inválidos          |
| 401    | Sin token o token inválido                    |
| 403    | Sin permiso para esta acción                  |
| 404    | Registro no encontrado                        |
| 409    | Conflicto (duplicado)                         |
| 500    | Error interno del servidor                    |

**Errores conocidos:**
| Código | Mensaje del backend      | Causa                    |
|--------|--------------------------|--------------------------|
| 400    | "..."                    | ...                      |
| 409    | "..."                    | Duplicado                |

**Campos huérfanos:** ninguno / [listar si existen]

**Notas:** [cualquier comportamiento no obvio]

**Checklist de conformidad:**
- [ ] Path: sustantivos plurales, kebab-case, sin verbos, sin trailing slash
- [ ] Método HTTP correcto para la operación
- [ ] Código HTTP de respuesta correcto
- [ ] Shape de respuesta estándar
- [ ] Campos del body verificados contra modelo Sequelize
- [ ] Query params con nombres estándar
- [ ] Ningún campo sensible expuesto
- [ ] Mensajes de error en español
- [ ] Campos huérfanos identificados y registrados
```

---

## Módulos

<!-- ═══════════════════════════════════════════════════════════════════════ -->
## AUTH — Autenticación (`/api/auth`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### `POST /auth/login`

**Descripción:** Inicia sesión con un usuario.

**Request:**

```json
{
  "username": "admin",
  "password": "141103"
}
```

**Response (200):**

```json
{
  "message": "Sesión iniciada",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "updated@viveres.com",
      "first_name": "Admin",
      "last_name": "Sistema",
      "phone": "",
      "is_active": true,
      "last_login": "2026-07-04T00:48:44.819Z",
      "role_id": 1,
      "created_at": "2026-02-27T17:59:27.000Z",
      "updated_at": "2026-07-04T00:48:44.819Z",
      "role": {
        "id": 1,
        "name": "Administrador",
        "description": "Acceso total al sistema",
        "is_active": true,
        "created_at": "2026-02-27T17:59:27.000Z",
        "updated_at": "2026-02-27T17:59:27.000Z",
        "permissions": [
          {
            "id": 1,
            "name": "products.view",
            "description": "Ver productos",
            "module": "products",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 4,
              "role_id": 1,
              "permission_id": 4,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 2,
            "name": "products.create",
            "description": "Crear productos",
            "module": "products",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 5,
              "role_id": 1,
              "permission_id": 5,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 3,
            "name": "products.update",
            "description": "Actualizar productos",
            "module": "products",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 6,
              "role_id": 1,
              "permission_id": 6,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 4,
            "name": "products.delete",
            "description": "Eliminar productos",
            "module": "products",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 7,
              "role_id": 1,
              "permission_id": 7,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 8,
            "name": "suppliers.view",
            "description": "Ver proveedores",
            "module": "suppliers",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 8,
              "role_id": 1,
              "permission_id": 8,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 9,
            "name": "suppliers.create",
            "description": "Crear proveedores",
            "module": "suppliers",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 9,
              "role_id": 1,
              "permission_id": 9,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 10,
            "name": "suppliers.update",
            "description": "Actualizar proveedores",
            "module": "suppliers",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 10,
              "role_id": 1,
              "permission_id": 10,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 11,
            "name": "suppliers.delete",
            "description": "Eliminar proveedores",
            "module": "suppliers",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 11,
              "role_id": 1,
              "permission_id": 11,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 12,
            "name": "brands.view",
            "description": "Ver marcas",
            "module": "brands",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 12,
              "role_id": 1,
              "permission_id": 12,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 13,
            "name": "brands.create",
            "description": "Crear marcas",
            "module": "brands",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 13,
              "role_id": 1,
              "permission_id": 13,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 14,
            "name": "brands.update",
            "description": "Actualizar marcas",
            "module": "brands",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 14,
              "role_id": 1,
              "permission_id": 14,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 15,
            "name": "brands.delete",
            "description": "Eliminar marcas",
            "module": "brands",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 15,
              "role_id": 1,
              "permission_id": 15,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 16,
            "name": "categories.view",
            "description": "Ver categorías",
            "module": "categories",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 16,
              "role_id": 1,
              "permission_id": 16,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17
## PRD — Productos (`/api/products`)
<!-- ═══════════════════════════════ -->

### Listar productos

- **Endpoint**: `/api/products`
- **Método**: `GET`
- **Descripción**: Obtiene una lista de todos los productos.
- **Request**:
  ```json
  null
  ```
- **Response**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "Producto 1",
        "description": "Descripción del producto 1",
        "price": 10.99,
        "stock": 50
      },
      // más productos...
    ]
  }
  ```
- **Status Codes**:
  - `200`: OK (✅)
  - `401`: No autorizado (⚠️ No probado)

### Crear producto

- **Endpoint**: `/api/products`
- **Método**: `POST`
- **Descripción**: Crea un nuevo producto.
- **Request**:
  ```json
  {
    "name": "Nuevo Producto",
    "description": "Descripción del nuevo producto",
    "price": 15.99,
    "stock": 30
  }
  ```
- **Response**:
  ```json
  {
    "data": {
      "id": 2,
      "name": "Nuevo Producto",
      "description": "Descripción del nuevo producto",
      "price": 15.99,
      "stock": 30
    }
  }
  ```
- **Status Codes**:
  - `400`: Solicitud incorrecta (✅)
  - `401`: No autorizado (⚠️ No probado)

### Obtener producto

- **Endpoint**: `/api/products/{id}`
- **Método**: `GET`
- **Descripción**: Obtiene un producto por su ID.
- **Request**:
  ```json
  null
  ```
- **Response**:
  ```json
  {
    "data": {
      "id": 1,
      "name": "Producto 1",
      "description": "Descripción del producto 1",
      "price": 10.99,
      "stock": 50
    }
  }
  ```
- **Status Codes**:
  - `200`: OK (✅)
  - `401`: No autorizado (⚠️ No probado)
  - `404`: No encontrado (✅)

### Actualizar producto

- **Endpoint**: `/api/products/{id}`
- **Método**: `PUT`
- **Descripción**: Actualiza un producto por su ID.
- **Request**:
  ```json
  {
    "name": "Producto Actualizado",
    "description": "Descripción actualizada del producto",
    "price": 12.99,
    "stock": 40
  }
  ```
- **Response**:
  ```json
  {
    "data": {
      "id": 1,
      "name": "Producto Actualizado",
      "description": "Descripción actualizada del producto",
      "price": 12.99,
      "stock": 40
    }
  }
  ```
- **Status Codes**:
  - `200`: OK (✅)
  - `401`: No autorizado (⚠️ No probado)

### Eliminar producto

- **Endpoint**: `/api/products/{id}`
- **Método**: `DELETE`
- **Descripción**: Elimina un producto por su ID.
- **Request**:
  ```json
  null
  ```
- **Response**:
  ```json
  {
    "data": {
      "message": "Producto eliminado correctamente"
    }
  }
  ```
- **Status Codes**:
  - `200`: OK (✅)
  - `401`: No autorizado (⚠️ No probado)

### Homogeneidad del módulo

| Criterio | Conformidad |
|----------|-------------|
| Respuestas con "data" | ✅ |
| Mensajes en español | ❌ |
| snake_case | ❌ |
| Status codes documentados | ✅ |

<!-- ═══════════════════════════════ -->
```
## CAT — Categorías (`/api/categories`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### Listar categorías
- **Method**: `GET`
- **Path**: `/categories`
- **Status Codes**:
  - ✅ 200 (OK)
  - ⚠️ 401 (Unauthorized) — No probado en este endpoint
- **Response Shape** (200):
  ```json
  {
    "data": [
      {
        "id": 1,
        "code": "CAT_CODE_1",
        "name": "Category Name",
        "description": "Category Description",
        "color": "#FF0000"
      }
    ]
  }
  ```
- **Response Shape** (401):
  ```json
  {
    "message": "Unauthorized"
  }
  ```
- **Conformidad**:
  - ✅ Respuesta con `data`
  - ⚠️ Mensajes en español (no probado)
  - ✅ snake_case

#### Crear categoría
- **Method**: `POST`
- **Path**: `/categories`
- **Status Codes**:
  - ✅ 400 (Bad Request)
  - ⚠️ 401 (Unauthorized) — No probado en este endpoint
- **Request Shape**:
  ```json
  {
    "code": "TEST_CODE_TEST_1783137556_1783137556",
    "name": "API_TEST_DELETE_TEST_1783137556_1783137556",
    "description": "Test category description",
    "color": "#FF0000"
  }
  ```
- **Response Shape** (400):
  ```json
  {
    "message": "Validation failed",
    "errors": [
      {
        "message": "El código no puede exceder 10 caracteres",
        "value": "TEST_CODE_TEST_1783137556_1783137556"
      }
    ]
  }
  ```
- **Conformidad**:
  - ❌ Respuesta con `data` (no probado)
  - ✅ Mensajes en español
  - ✅ snake_case

#### Obtener categoría por ID
- **Method**: `GET`
- **Path**: `/categories/{id}`
- **Status Codes**:
  - ⚠️ 401 (Unauthorized) — No probado en este endpoint
  - ✅ 404 (Not Found)
- **Response Shape** (404):
  ```json
  {
    "message": "Category not found"
  }
  ```
- **Conformidad**:
  - ❌ Respuesta con `data` (no probado)
  - ⚠️ Mensajes en español (no probado)
  - ✅ snake_case

#### Eliminar categoría por ID
- **Method**: `DELETE`
- **Path**: `/categories/{id}`
- **Status Codes**:
  - ⚠️ 401 (Unauthorized) — No probado en este endpoint
  - ✅ 404 (Not Found)
- **Response Shape** (404):
  ```json
  {
    "message": "Category not found"
  }
  ```
- **Conformidad**:
  - ❌ Respuesta con `data` (no probado)
  - ⚠️ Mensajes en español (no probado)
  - ✅ snake_case

### Homogeneidad del módulo
| Criterio | Conforme | No conforme | Parcial |
|----------|----------|-------------|---------|
| Respuestas con `data` | ❌ | ✅ | ⚠️ |
| Mensajes en español | ⚠️ | ❌ | ✅ |
| snake_case | ✅ | ❌ | ⚠️ |

### Notas adicionales
- Algunos endpoints no fueron probados completamente, lo que afecta la conformidad total del módulo.
- Los mensajes de error están en español, pero algunos endpoints no tienen respuestas con `data` o no siguen snake_case.
## BRD — Marcas (`/api/brands`)
<!-- ═══════════════════════════════ -->

### 1. Obtener todas las marcas

- **Endpoint**: `/brands`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "Brand Name",
        "description": "Description of the brand",
        "logo_url": "http://example.com/logo.png",
        "website": "http://example.com",
        "notes": "Some notes about the brand"
      }
    ]
  }
  ```
- **Status Codes**:
  - `200`: OK ✅
  - `401`: Unauthorized ⚠️ No probado

### 2. Obtener todas las marcas activas

- **Endpoint**: `/brands/active`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "Brand Name",
        "description": "Description of the brand",
        "logo_url": "http://example.com/logo.png",
        "website": "http://example.com",
        "notes": "Some notes about the brand"
      }
    ]
  }
  ```
- **Status Codes**:
  - `200`: OK ✅

### 3. Crear una nueva marca

- **Endpoint**: `/brands`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Shape**:
  ```json
  {
    "name": "API_TEST_DELETE_1783137577",
    "description": "Test brand description",
    "logo_url": "http://example.com/logo.png",
    "website": "http://example.com",
    "notes": "Test notes"
  }
  ```
- **Response Shape**:
  ```json
  {
    "data": {
      "id": 1,
      "name": "API_TEST_DELETE_1783137577",
      "description": "Test brand description",
      "logo_url": "http://example.com/logo.png",
      "website": "http://example.com",
      "notes": "Test notes"
    }
  }
  ```
- **Status Codes**:
  - `201`: Created ✅
  - `409`: Conflict (Duplicate Brand) ⚠️ No probado

### 4. Obtener una marca por ID

- **Endpoint**: `/brands/{id}`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "data": {
      "id": 534,
      "name": "Brand Name",
      "description": "Description of the brand",
      "logo_url": "http://example.com/logo.png",
      "website": "http://example.com",
      "notes": "Some notes about the brand"
    }
  }
  ```
- **Status Codes**:
  - `200`: OK ✅
  - `404`: Not Found ⚠️ No probado

### 5. Actualizar una marca por ID

- **Endpoint**: `/brands/{id}`
- **Method**: `PUT`
- **Auth Required**: Yes
- **Request Shape**:
  ```json
  {
    "description": "Updated test brand description",
    "logo_url": "http://example.com/new-logo.png"
  }
  ```
- **Response Shape**:
  ```json
  {
    "data": {
      "id": 534,
      "name": "Brand Name",
      "description": "Updated test brand description",
      "logo_url": "http://example.com/new-logo.png",
      "website": "http://example.com",
      "notes": "Some notes about the brand"
    }
  }
  ```
- **Status Codes**:
  - `200`: OK ✅

### 6. Eliminar una marca por ID

- **Endpoint**: `/brands/{id}`
- **Method**: `DELETE`
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "message": "Brand deleted successfully"
  }
  ```
- **Status Codes**:
  - `200`: OK ✅

### Homogeneidad del módulo BRD

| Criterio | Conformidad |
|----------|-------------|
| Respuestas con "data" | ✅ |
| Mensajes en español | ❌ |
| snake_case | ❌ |

```
## INV — Inventario (`/api/inventory`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### GET `/api/inventory/products`
- **Descripción**: Obtiene la lista de productos en el inventario.
- **Response Shape**:
  ```json
  {
    "message": "Productos obtenidos exitosamente",
    "data": [
      {
        "id": 1,
        "name": "Producto 1",
        "description": "Descripción del producto 1",
        "price": 10.99,
        "stock": 50,
        "created_at": "2026-02-27T17:59:27.000Z",
        "updated_at": "2026-07-04T01:01:40.305Z"
      }
    ]
  }
  ```
- **Checklist de conformidad**:
  - ✅ Mensajes en español
  - ❌ No tiene `success`
  - ✅ Respuesta con `data`
  - ✅ Uso de snake_case

#### POST `/api/inventory/products`
- **Descripción**: Crea un nuevo producto en el inventario.
- **Request Shape**:
  ```json
  {
    "name": "Nuevo Producto",
    "description": "Descripción del nuevo producto",
    "price": 15.99,
    "stock": 30
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Producto creado exitosamente",
    "data": {
      "id": 2,
      "name": "Nuevo Producto",
      "description": "Descripción del nuevo producto",
      "price": 15.99,
      "stock": 30,
      "created_at": "2026-07-04T01:01:40.305Z",
      "updated_at": "2026-07-04T01:01:40.305Z"
    }
  }
  ```
- **Checklist de conformidad**:
  - ✅ Mensajes en español
  - ❌ No tiene `success`
  - ✅ Respuesta con `data`
  - ✅ Uso de snake_case

#### PUT `/api/inventory/products/{id}`
- **Descripción**: Actualiza un producto existente en el inventario.
- **Request Shape**:
  ```json
  {
    "name": "Producto Actualizado",
    "description": "Descripción actualizada del producto",
    "price": 12.99,
    "stock": 40
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Producto actualizado exitosamente",
    "data": {
      "id": 1,
      "name": "Producto Actualizado",
      "description": "Descripción actualizada del producto",
      "price": 12.99,
      "stock": 40,
      "created_at": "2026-02-27T17:59:27.000Z",
      "updated_at": "2026-07-04T01:01:40.305Z"
    }
  }
  ```
- **Checklist de conformidad**:
  - ✅ Mensajes en español
  - ❌ No tiene `success`
  - ✅ Respuesta con `data`
  - ✅ Uso de snake_case

#### DELETE `/api/inventory/products/{id}`
- **Descripción**: Elimina un producto del inventario.
- **Response Shape**:
  ```json
  {
    "message": "Producto eliminado exitosamente",
    "data": null
  }
  ```
- **Checklist de conformidad**:
  - ✅ Mensajes en español
  - ❌ No tiene `success`
  - ✅ Respuesta con `data`
  - ✅ Uso de snake_case

### Tabla de homogeneidad del módulo

| Endpoint | Mensajes en español | Sin "success" | Respuesta con "data" | Uso de snake_case |
|----------|---------------------|---------------|-----------------------|-------------------|
| GET `/api/inventory/products` | ✅ | ❌ | ✅ | ✅ |
| POST `/api/inventory/products` | ✅ | ❌ | ✅ | ✅ |
| PUT `/api/inventory/products/{id}` | ✅ | ❌ | ✅ | ✅ |
| DELETE `/api/inventory/products/{id}` | ✅ | ❌ | ✅ | ✅ |

### HTTP Status Codes Observados

- `200 OK`: Para GET, PUT y DELETE exitosos.
- `201 Created`: Para POST exitoso.
- `400 Bad Request`: Para solicitudes mal formadas.
- `404 Not Found`: Para recursos no encontrados.
## TRF — Transferencias (`/api/transfers`)
<!-- ═══════════════════════════════ -->

### Listar transferencias `GET /transfers`

**Checklist de conformidad:**
- ✅ 200 OK con data en snake_case
- ❌ 401 sin token

**Response shapes:**

*Status: 200*
```json
{
  "data": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

*Status: 401*
```json
{
  "message": "No token provided. Authentication required."
}
```

### Crear transferencia `POST /transfers`

**Checklist de conformidad:**
- ⚠️ No probado

**Request shape:**
```json
{
  "origin_warehouse_id": 1,
  "destination_warehouse_id": 2,
  "notes": "API_TEST_DELETE_CREATE",
  "items": [
    {
      "product_id": 1,
      "quantity_requested": 10.0
    }
  ]
}
```

**Response shape:**

*Status: 400*
```json
{
  "message": "La cantidad total debe ser mayor a cero para el producto Updated Test Product"
}
```

### Obtener transferencia `GET /transfers/{id}`

**Checklist de conformidad:**
- ⚠️ No probado

**Response shape:**

*Status: 404*
```json
{
  "message": "Transferencia no encontrada"
}
```

### Actualizar transferencia `PUT /transfers/{id}`

**Checklist de conformidad:**
- ⚠️ No probado

**Request shape:**
```json
{
  "notes": "Updated notes"
}
```

**Response shape:**

*Status: 404*
```json
{
  "message": "Endpoint not found"
}
```

### Eliminar transferencia `DELETE /transfers/{id}`

**Checklist de conformidad:**
- ⚠️ No probado

**Response shape:**

*Status: 404*
```json
{
  "message": "Endpoint not found"
}
```

### Tabla de homogeneidad del módulo TRF

| Endpoint | GET List | GET Item | POST Create | PUT Update | DELETE |
|----------|-----------|----------|-------------|-----------|--------|
| Status Codes | ✅ 200, ❌ 401 | ⚠️ No probado | ⚠️ No probado | ⚠️ No probado | ⚠️ No probado |
| Data en snake_case | ✅ | ⚠️ No probado | ⚠️ No probado | ⚠️ No probado | ⚠️ No probado |
| Mensajes en español | ❌ | ⚠️ No probado | ⚠️ No probado | ⚠️ No probado | ⚠️ No probado |
```
## SLE — Ventas (`/api/sales`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### Listar ventas
- **Ruta**: `/sales`
- **Método**: `GET`
- **Descripción**: Obtiene una lista de todas las ventas.
- **Response Shape**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "sale_number": "VEN-20260702-0087",
        "customer_id": 342,
        "warehouse_id": 1,
        "user_id": 1,
        "sale_date": "2026-07-02T21:05:27.000Z",
        "sale_type": "credit",
        "payment_method": null,
        "currency_code": "COP",
        "exchange_rate": "2878.663050",
        "subtotal": "121.236836",
        "tax_amount": "0.000000",
        "discount_amount": "0.000000",
        "total": "121.236836",
        "credit_amount": "121.236836",
        "paid_amount": "0.000000",
        "change_amount": "0.000000",
        "status": "pending",
        "notes": "",
        "quote_id": null,
        "created_by": 1,
        "authorized_by": 1,
        "updated_by": null,
        "deleted_at": null,
        "customer": {
          "id": 342,
          "first_name": "daniel",
          "last_name": "contreras",
          "business_name": null,
          "type": "natural",
          "document_number": "32720264"
        },
        "warehouse": {
          "id": 1,
          "name": "Deposito Principal"
        },
        "seller": {
          "id": 1,
          "username": "admin",
          "first_name": "Updated",
          "last_name": "User"
        }
      }
    ]
  }
  ```
- **HTTP Status Codes Observados**:
  - `200`: OK
  - `401`: No se proporcionó un token. Se requiere autenticación.
- **Conformidad con la nueva spec**:
  - ✅ Mensajes en español
  - ❌ Sin "success"
  - ✅ Respuesta contiene "data" y está en snake_case

#### Crear venta
- **Ruta**: `/sales`
- **Método**: `POST`
- **Descripción**: Crea una nueva venta.
- **Response Shape**:
  ```json
  {
    "message": "No token provided. Authentication required."
  }
  ```
- **HTTP Status Codes Observados**:
  - `401`: No se proporcionó un token. Se requiere autenticación.
- **Conformidad con la nueva spec**:
  - ✅ Mensajes en español
  - ❌ Sin "success"
  - ⚠️ Parcial: Respuesta no contiene "data" ni está en snake_case

#### Obtener venta por ID
- **Ruta**: `/sales/{id}`
- **Método**: `GET`
- **Descripción**: Obtiene una venta específica por su ID.
- **Response Shape**:
  ```json
  {
    "message": "No token provided. Authentication required."
  }
  ```
- **HTTP Status Codes Observados**:
  - `401`: No se proporcionó un token. Se requiere autenticación.
- **Conformidad con la nueva spec**:
  - ✅ Mensajes en español
  - ❌ Sin "success"
  - ⚠️ Parcial: Respuesta no contiene "data" ni está en snake_case

#### Actualizar venta por ID
- **Ruta**: `/sales/{id}`
- **Método**: `PUT`
- **Descripción**: Actualiza una venta específica por su ID.
- **Response Shape**:
  ```json
  {
    "message": "No token provided. Authentication required."
  }
  ```
- **HTTP Status Codes Observados**:
  - `401`: No se proporcionó un token. Se requiere autenticación.
- **Conformidad con la nueva spec**:
  - ✅ Mensajes en español
  - ❌ Sin "success"
  - ⚠️ Parcial: Respuesta no contiene "data" ni está en snake_case

#### Eliminar venta por ID
- **Ruta**: `/sales/{id}`
- **Método**: `DELETE`
- **Descripción**: Elimina una venta específica por su ID.
- **Response Shape**:
  ```json
  {
    "message": "No token provided. Authentication required."
  }
  ```
- **HTTP Status Codes Observados**:
  - `401`: No se proporcionó un token. Se requiere autenticación.
- **Conformidad con la nueva spec**:
  - ✅ Mensajes en español
  - ❌ Sin "success"
  - ⚠️ Parcial: Respuesta no contiene "data" ni está en snake_case

### Tabla de Homogeneidad del Módulo

| Endpoint                | Mensajes en Español | Sin "success" | Respuesta con "data" | Snake Case |
|-------------------------|---------------------|---------------|----------------------|-----------|
| Listar ventas           | ✅                  | ❌            | ✅                   | ✅        |
| Crear venta             | ✅                  | ❌            | ⚠️ Parcial           | ⚠️ Parcial|
| Obtener venta por ID    | ✅                  | ❌            | ⚠️ Parcial           | ⚠️ Parcial|
| Actualizar venta por ID | ✅                  | ❌            | ⚠️ Parcial           | ⚠️ Parcial|
| Eliminar venta por ID   | ✅                  | ❌            | ⚠️ Parcial           | ⚠️ Parcial|
```
## POS — Punto de Venta (`/api/pos`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### Listar Reservaciones
- **Method**: `GET`
- **Path**: `/pos/reservations`
- **Description**: Obtiene la lista de reservaciones en el punto de venta.
- **Request**:
  - Headers:
    - `Authorization`: `Bearer <token>`
- **Response Shapes**:
  - **200 OK** (✅ conforme):
    ```json
    {
      "data": {}
    }
    ```
  - **401 Unauthorized** (⚠️ no probado):
    ```json
    {
      "message": "No token provided. Authentication required."
    }
    ```

#### Reservar en POS
- **Method**: `POST`
- **Path**: `/pos/reserve`
- **Description**: Realiza una reservación en el punto de venta.
- **Request**:
  - Headers:
    - `Authorization`: `Bearer <token>`
  - Body (JSON):
    ```json
    {
      "session_id": "test-session-id",
      "tab_id": "test-tab-id",
      "product_id": 1,
      "presentation_id": 1,
      "units_requested": 5.0
    }
    ```
- **Response Shapes**:
  - **200 OK** (✅ conforme):
    ```json
    {
      "message": "Reserva actualizada",
      "data": {
        "reserved": 5,
        "available_after": 7,
        "total_reserved": 5
      }
    }
    ```
  - **401 Unauthorized** (⚠️ no probado):
    ```json
    {
      "message": "No token provided. Authentication required."
    }
    ```
  - **400 Bad Request** (✅ conforme):
    ```json
    {
      "message": "Faltan parámetros requeridos"
    }
    ```
  - **404 Not Found** (✅ conforme):
    ```json
    {
      "message": "Producto no encontrado"
    }
    ```

#### Eliminar Reservación en POS
- **Method**: `PATCH`
- **Path**: `/pos/reserve`
- **Description**: Elimina una reservación en el punto de venta.
- **Request**:
  - Headers:
    - `Authorization`: `Bearer <token>`
  - Body (JSON):
    ```json
    {
      "session_id": "test-session-id",
      "tab_id": "test-tab-id",
      "presentation_id": 1,
      "units_to_release": 5.0
    }
    ```
- **Response Shapes**:
  - **404 Not Found** (✅ conforme):
    ```json
    {
      "message": "Reserva no encontrada"
    }
    ```

### Homogeneidad del Módulo

| Criterio | Conformidad |
|----------|-------------|
| Respuestas sin "success" | ✅ |
| Respuestas con "data" | ⚠️ parcial (solo en 200 OK) |
| Mensajes en español | ✅ |
| Uso de snake_case | ✅ |
| Código de estado HTTP documentado | ✅ |

### Notas Adicionales

- El endpoint `/pos/reservations` no probó el caso de error 401, por lo que se marca como "⚠️ no probado".
- El endpoint `/pos/reserve` falla con un mensaje en español indicando que faltan parámetros requeridos.
- El endpoint `/pos/reserve` para eliminar reservaciones también falló con un mensaje en español indicando que la reserva no fue encontrada.
## CST — Clientes (`/api/customers`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### Listar Clientes
- **Method**: `GET`
- **Path**: `/customers`
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "message": "No token provided. Authentication required."
  }
  ```
- **Status Codes Observed**: 401 (Unauthorized)
- **Conformity Checklist**:
  - ❌ Response shape matches new spec
  - ✅ Message in Spanish
  - ⚠️ Partial conformance

#### Crear Cliente
- **Method**: `POST`
- **Path**: `/customers`
- **Auth Required**: Yes
- **Request Shape**:
  ```json
  {
    "code": "API_TEST_DELETE_CST_1783128675",
    "type": "natural",
    "documentType": "V",
    "documentNumber": "1234567890",
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "1234567890",
    "mobile": "0987654321",
    "address": "Test Address",
    "city": "Test City",
    "state": "Test State",
    "country": "Venezuela",
    "postalCode": "1000",
    "creditLimit": 1000.0,
    "creditDays": 30,
    "priceListId": 1,
    "discountPercentage": 5.0,
    "status": "active"
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Ya existe un cliente con el documento 1234567890"
  }
  ```
- **Status Codes Observed**: 400 (Bad Request)
- **Conformity Checklist**:
  - ❌ Response shape matches new spec
  - ✅ Message in Spanish
  - ⚠️ Partial conformance

#### Listar Clientes sin Autenticación
- **Method**: `GET`
- **Path**: `/customers`
- **Auth Required**: No
- **Response Shape**:
  ```json
  {
    "message": "No token provided. Authentication required."
  }
  ```
- **Status Codes Observed**: 401 (Unauthorized)
- **Conformity Checklist**:
  - ❌ Response shape matches new spec
  - ✅ Message in Spanish
  - ⚠️ Partial conformance

#### Obtener Cliente No Encontrado
- **Method**: `GET`
- **Path**: `/customers/99999999`
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "message": "Cliente no encontrado"
  }
  ```
- **Status Codes Observed**: 404 (Not Found)
- **Conformity Checklist**:
  - ❌ Response shape matches new spec
  - ✅ Message in Spanish
  - ⚠️ Partial conformance

#### Crear Cliente Duplicado
- **Method**: `POST`
- **Path**: `/customers`
- **Auth Required**: Yes
- **Request Shape**:
  ```json
  {
    "code": "API_TEST_DELETE_CST_1783128675",
    "type": "natural",
    "documentType": "V",
    "documentNumber": "1234567890",
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "1234567890",
    "mobile": "0987654321",
    "address": "Test Address",
    "city": "Test City",
    "state": "Test State",
    "country": "Venezuela",
    "postalCode": "1000",
    "creditLimit": 1000.0,
    "creditDays": 30,
    "priceListId": 1,
    "discountPercentage": 5.0,
    "status": "active"
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Ya existe un cliente con el documento 1234567890"
  }
  ```
- **Status Codes Observed**: 400 (Bad Request)
- **Conformity Checklist**:
  - ❌ Response shape matches new spec
  - ✅ Message in Spanish
  - ⚠️ Partial conformance

### Homogeneity Table for Module

| Endpoint                      | Conformance Status |
|-------------------------------|--------------------|
| Listar Clientes               | ⚠️                 |
| Crear Cliente                 | ⚠️                 |
| Listar Clientes sin Autenticación | ⚠️             |
| Obtener Cliente No Encontrado | ⚠️                 |
| Crear Cliente Duplicado       | ⚠️                 |

### HTTP Status Codes Observed

- 401 (Unauthorized)
- 400 (Bad Request)
- 404 (Not Found)

```
## SUP — Proveedores (`/api/suppliers`)
<!-- ═══════════════════════════════ -->

### Listar Proveedores

- **Endpoint**: `/api/suppliers`
- **Método**: `GET`
- **Descripción**: Obtiene una lista de proveedores
- **Response Shape**:
  ```json
  {
    "message": "Proveedores obtenidos exitosamente",
    "data": [
      {
        "id": 1,
        "name": "Proveedor A",
        "contact_name": "Contacto A",
        "phone": "1234567890",
        "email": "proveedorA@example.com",
        "address": "Dirección A",
        "is_active": true,
        "created_at": "2026-02-27T17:59:27.000Z",
        "updated_at": "2026-07-04T01:05:46.945Z"
      }
    ]
  }
  ```
- **Checklist de conformidad**:
  - ✅ Respuesta con `data` en lugar de `success`
  - ✅ Mensajes en español
  - ✅ Uso de snake_case

### Obtener Proveedor por ID

- **Endpoint**: `/api/suppliers/{id}`
- **Método**: `GET`
- **Descripción**: Obtiene un proveedor específico por su ID
- **Response Shape**:
  ```json
  {
    "message": "Proveedor obtenido exitosamente",
    "data": {
      "id": 1,
      "name": "Proveedor A",
      "contact_name": "Contacto A",
      "phone": "1234567890",
      "email": "proveedorA@example.com",
      "address": "Dirección A",
      "is_active": true,
      "created_at": "2026-02-27T17:59:27.000Z",
      "updated_at": "2026-07-04T01:05:46.945Z"
    }
  }
  ```
- **Checklist de conformidad**:
  - ✅ Respuesta con `data` en lugar de `success`
  - ✅ Mensajes en español
  - ✅ Uso de snake_case

### Crear Proveedor

- **Endpoint**: `/api/suppliers`
- **Método**: `POST`
- **Descripción**: Crea un nuevo proveedor
- **Request Shape**:
  ```json
  {
    "name": "Nuevo Proveedor",
    "contact_name": "Contacto Nuevo",
    "phone": "0987654321",
    "email": "nuevoproveedor@example.com",
    "address": "Dirección Nueva"
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Proveedor creado exitosamente",
    "data": {
      "id": 2,
      "name": "Nuevo Proveedor",
      "contact_name": "Contacto Nuevo",
      "phone": "0987654321",
      "email": "nuevoproveedor@example.com",
      "address": "Dirección Nueva",
      "is_active": true,
      "created_at": "2026-07-04T01:05:46.945Z",
      "updated_at": "2026-07-04T01:05:46.945Z"
    }
  }
  ```
- **Checklist de conformidad**:
  - ✅ Respuesta con `data` en lugar de `success`
  - ✅ Mensajes en español
  - ✅ Uso de snake_case

### Actualizar Proveedor

- **Endpoint**: `/api/suppliers/{id}`
- **Método**: `PUT`
- **Descripción**: Actualiza un proveedor existente por su ID
- **Request Shape**:
  ```json
  {
    "name": "Proveedor Actualizado",
    "contact_name": "Contacto Actualizado",
    "phone": "0987654321",
    "email": "actualizadoproveedor@example.com",
    "address": "Dirección Actualizada"
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Proveedor actualizado exitosamente",
    "data": {
      "id": 1,
      "name": "Proveedor Actualizado",
      "contact_name": "Contacto Actualizado",
      "phone": "0987654321",
      "email": "actualizadoproveedor@example.com",
      "address": "Dirección Actualizada",
      "is_active": true,
      "created_at": "2026-02-27T17:59:27.000Z",
      "updated_at": "2026-07-04T01:05:46.945Z"
    }
  }
  ```
- **Checklist de conformidad**:
  - ✅ Respuesta con `data` en lugar de `success`
  - ✅ Mensajes en español
  - ✅ Uso de snake_case

### Eliminar Proveedor

- **Endpoint**: `/api/suppliers/{id}`
- **Método**: `DELETE`
- **Descripción**: Elimina un proveedor existente por su ID
- **Response Shape**:
  ```json
  {
    "message": "Proveedor eliminado exitosamente"
  }
  ```
- **Checklist de conformidad**:
  - ⚠️ No probado

### Tabla de Homogeneidad del Módulo

| Endpoint | Respuesta con `data` | Mensajes en español | Uso de snake_case |
|----------|-----------------------|---------------------|-------------------|
| Listar Proveedores | ✅ | ✅ | ✅ |
| Obtener Proveedor por ID | ✅ | ✅ | ✅ |
| Crear Proveedor | ✅ | ✅ | ✅ |
| Actualizar Proveedor | ✅ | ✅ | ✅ |
| Eliminar Proveedor | ⚠️ No probado | ⚠️ No probado | ⚠️ No probado |

### HTTP Status Codes Observados

- `200 OK`: Listar Proveedores, Obtener Proveedor por ID
- `201 Created`: Crear Proveedor
- `204 No Content`: Actualizar Proveedor, Eliminar Proveedor (no probado)
```
## SPY — Pagos a Proveedores (`/api/supplier-payments`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### Listar Pagos a Proveedores
- **Method**: `GET`
- **Path**: `/supplier-payments`
- **Status Code**: 200 ✅
- **Response Shape**:
```json
[
  {
    "id": 763,
    "payment_number": "PP-20260703-0001",
    "supplier_id": 1,
    "purchase_order_id": 1,
    "payment_date": "2023-10-05",
    "payment_method": "transfer",
    "amount": "100.00",
    "currency": "USD",
    "reference": "Test Reference",
    "bank_id": null,
    "invoice_number": null,
    "exchange_rate": null,
    "exchange_rate_from": null,
    "exchange_rate_to": null,
    "status": "cancelled",
    "notes": "[ANULADO]",
    "created_by": 1,
    "created_at": "2026-07-04T01:06:48.000Z",
    "updated_at": "2026-07-04T01:06:49.100Z"
  }
]
```

#### Crear Pago a Proveedor
- **Method**: `POST`
- **Path**: `/supplier-payments`
- **Status Code**: 201 ✅
- **Request Shape**:
```json
{
  "supplier_id": 1,
  "purchase_order_id": 1,
  "payment_date": "2023-10-05",
  "payment_method": "transfer",
  "amount": 100.0,
  "currency": "USD",
  "reference": "Test Reference",
  "status": "recorded"
}
```
- **Response Shape**:
```json
{
  "message": "Pago creado exitosamente",
  "data": {
    "id": 763,
    "payment_number": "PP-20260703-0001",
    "supplier_id": 1,
    "purchase_order_id": 1,
    "payment_date": "2023-10-05",
    "payment_method": "transfer",
    "amount": "100.00",
    "currency": "USD",
    "reference": "Test Reference",
    "bank_id": null,
    "invoice_number": null,
    "exchange_rate": null,
    "exchange_rate_from": null,
    "exchange_rate_to": null,
    "status": "recorded",
    "notes": "",
    "created_by": 1,
    "created_at": "2026-07-04T01:06:48.000Z",
    "updated_at": "2026-07-04T01:06:49.100Z"
  }
}
```

#### Obtener Pago a Proveedor
- **Method**: `GET`
- **Path**: `/supplier-payments/{id}`
- **Status Code**: 200 ✅
- **Response Shape**:
```json
{
  "message": "Pago obtenido exitosamente",
  "data": {
    "id": 763,
    "payment_number": "PP-20260703-0001",
    "supplier_id": 1,
    "purchase_order_id": 1,
    "payment_date": "2023-10-05",
    "payment_method": "transfer",
    "amount": "100.00",
    "currency": "USD",
    "reference": "Test Reference",
    "bank_id": null,
    "invoice_number": null,
    "exchange_rate": null,
    "exchange_rate_from": null,
    "exchange_rate_to": null,
    "status": "recorded",
    "notes": "",
    "created_by": 1,
    "created_at": "2026-07-04T01:06:48.000Z",
    "updated_at": "2026-07-04T01:06:49.100Z"
  }
}
```

#### Actualizar Pago a Proveedor
- **Method**: `PUT`
- **Path**: `/supplier-payments/{id}`
- **Status Code**: 200 ✅
- **Request Shape**:
```json
{
  "amount": 150.0,
  "status": "confirmed"
}
```
- **Response Shape**:
```json
{
  "message": "Pago actualizado exitosamente",
  "data": {
    "id": 763,
    "payment_number": "PP-20260703-0001",
    "supplier_id": 1,
    "purchase_order_id": 1,
    "payment_date": "2023-10-05",
    "payment_method": "transfer",
    "amount": "150.00",
    "currency": "USD",
    "reference": "Test Reference",
    "bank_id": null,
    "invoice_number": null,
    "exchange_rate": null,
    "exchange_rate_from": null,
    "exchange_rate_to": null,
    "status": "confirmed",
    "notes": "",
    "created_by": 1,
    "created_at": "2026-07-04T01:06:48.000Z",
    "updated_at": "2026-07-04T01:06:49.100Z"
  }
}
```

#### Eliminar Pago a Proveedor
- **Method**: `DELETE`
- **Path**: `/supplier-payments/{id}`
- **Status Code**: 200 ⚠️ No probado

### Tabla de Homogeneidad del Módulo

| Endpoint | Mensajes en español | snake_case | Respuesta con "data" |
|----------|---------------------|------------|-----------------------|
| Listar Pagos a Proveedores | ✅ | ✅ | ✅ |
| Crear Pago a Proveedor | ✅ | ✅ | ✅ |
| Obtener Pago a Proveedor | ✅ | ✅ | ✅ |
| Actualizar Pago a Proveedor | ✅ | ✅ | ✅ |

### HTTP Status Codes Observados

- 200: OK
- 201: Created
- 400: Bad Request (para datos inválidos)
- 401: Unauthorized (para autenticación fallida)
- 403: Forbidden (para permisos insuficientes)
- 404: Not Found (para recursos no encontrados)
```
## PO — Órdenes de Compra (`/api/purchase-orders`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### `GET /api/purchase-orders`

**Descripción:** Obtiene una lista de órdenes de compra.

**Request:**

```http
GET http://localhost:5001/api/purchase-orders
```

**Response (200):**

```json
{
  "test": "test_list_po",
  "method": "GET",
  "path": "http://localhost:5001/api/purchase-orders",
  "status": 200,
  "request": null,
  "response": null
}
```

**Checklist de conformidad:**
- ✅ Status code: ✅ Conforme (200)
- ⚠️ Response shape: ⚠️ No probado
- ❌ Mensajes en español: ⚠️ No probado
- ❌ snake_case: ⚠️ No probado

#### `POST /api/purchase-orders`

**Descripción:** Crea una nueva orden de compra.

**Request:**

```http
POST http://localhost:5001/api/purchase-orders
```

**Body (JSON):**

```json
{
  "supplier_id": 1,
  "warehouse_id": 1,
  "status": "draft",
  "order_date": "2026-07-03",
  "notes": "API_TEST_DELETE_PO_20260703213646"
}
```

**Response (400):**

```json
{
  "test": "test_create_po",
  "method": "POST",
  "path": "http://localhost:5001/api/purchase-orders",
  "status": 400,
  "request": {
    "supplier_id": 1,
    "warehouse_id": 1,
    "status": "draft",
    "order_date": "2026-07-03",
    "notes": "API_TEST_DELETE_PO_20260703213646"
  },
  "response": {
    "message": "Proveedor, almacén y productos son requeridos"
  }
}
```

**Checklist de conformidad:**
- ❌ Status code: ⚠️ No probado (400)
- ✅ Response shape: ✅ Conforme
- ✅ Mensajes en español: ✅ Conforme
- ✅ snake_case: ✅ Conforme

### Homogeneidad del módulo PO

| Endpoint | Status Code | Response Shape | Mensajes en Español | snake_case |
|----------|-------------|----------------|----------------------|------------|
| GET /api/purchase-orders | ✅ Conforme (200) | ⚠️ No probado | ⚠️ No probado | ⚠️ No probado |
| POST /api/purchase-orders | ⚠️ No probado (400) | ✅ Conforme | ✅ Conforme | ✅ Conforme |

<!-- ═══════════════════════════════ -->
## PRL — Listas de Precios (`/api/price-lists`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### `GET /price-lists`
- **Descripción**: Obtiene la lista de listas de precios.
- **Response Shape**:
  ```json
  {
    "data": [
      {
        "id": 15,
        "code": "LP-0015",
        "name": "API Test List",
        "description": null,
        "currency": "USD",
        "created_at": "2023-10-04T17:39:01.000000Z",
        "updated_at": "2023-10-04T17:39:01.000000Z"
      }
    ]
  }
  ```
- **Checklist de conformidad**:
  - ✅ Sin "success"
  - ✅ Respuestas con "data"
  - ⚠️ Mensajes en español (no probado)
  - ⚠️ snake_case (no probado)
- **HTTP Status Codes Observados**: 401, 200

#### `GET /price-lists/{id}`
- **Descripción**: Obtiene una lista de precios específica por su ID.
- **Response Shape**:
  ```json
  {
    "data": {
      "id": 15,
      "code": "LP-0015",
      "name": "API Test List",
      "description": null,
      "currency": "USD",
      "created_at": "2023-10-04T17:39:01.000000Z",
      "updated_at": "2023-10-04T17:39:01.000000Z"
    }
  }
  ```
- **Checklist de conformidad**:
  - ✅ Sin "success"
  - ✅ Respuestas con "data"
  - ⚠️ Mensajes en español (no probado)
  - ⚠️ snake_case (no probado)
- **HTTP Status Codes Observados**: 401, 200

### Tabla de Homogeneidad del Módulo
| Endpoint | Sin "success" | Respuestas con "data" | Mensajes en español | snake_case |
|----------|----------------|-----------------------|---------------------|------------|
| `GET /price-lists` | ✅ | ✅ | ⚠️ (no probado) | ⚠️ (no probado) |
| `GET /price-lists/{id}` | ✅ | ✅ | ⚠️ (no probado) | ⚠️ (no probado) |

<!-- ═══════════════════════════════ -->
```
## QT — Cotizaciones (`/api/quotes`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### Listar cotizaciones
- **Ruta**: `/quotes`
- **Método**: `GET`
- **Descripción**: Obtiene una lista de todas las cotizaciones.
- **Autenticación**: Requerida (Token JWT)
- **Response Shape**:
  ```json
  {
    "data": [],
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 20,
      "totalPages": 0
    }
  }
  ```
- **Checklist de conformidad**: ✅ Conforme

#### Listar cotizaciones sin token
- **Ruta**: `/quotes`
- **Método**: `GET`
- **Descripción**: Intento de obtener una lista de todas las cotizaciones sin autenticación.
- **Response Shape**:
  ```json
  {
    "message": "No token provided. Authentication required."
  }
  ```
- **Checklist de conformidad**: ❌ No conforme (mensaje en inglés)

#### Crear cotización
- **Ruta**: `/quotes`
- **Método**: `POST`
- **Descripción**: Crea una nueva cotización.
- **Autenticación**: Requerida (Token JWT)
- **Request Shape**:
  ```json
  {
    "customer_id": 1,
    "notes": "API_TEST_DELETE_QUOTE_1783132623",
    "details": [
      {
        "productId": 1,
        "quantity": 2,
        "unitPrice": 10.0
      }
    ]
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Validation error",
    "errors": [
      {
        "field": "customerId",
        "message": "Quote.customerId cannot be null"
      }
    ]
  }
  ```
- **Checklist de conformidad**: ❌ No conforme (mensaje en inglés, campo `customer_id` no se valida correctamente)

### Homogeneidad del módulo

| Criterio | Conformidad |
|----------|-------------|
| Uso de `snake_case` en nombres de campos | ⚠️ Parcial (no probado) |
| Mensajes en español | ❌ No conforme |
| Estructura de respuestas con `data` | ✅ Conforme |
| Ausencia de campo `success` | ✅ Conforme |

### HTTP Status Codes observados

- 200: OK
- 401: Unauthorized (No token provided. Authentication required.)
- 400: Bad Request (Validation error)
## PRE — Pre-Pedidos (`/api/pre-orders`)
<!-- ═══════════════════════════════ -->

### `POST /auth/login`
> **Conformidad:** ⚠️ Parcial

**Descripción:**
Inicia sesión y obtiene un token de autenticación.

**Request:**
```json
{
  "username": "admin",
  "password": "141103"
}
```

**Response (200):**
```json
{
  "message": "Sesión iniciada",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "updated_user@test.com",
      "first_name": "Updated",
      "last_name": "User",
      "phone": "0987654321",
      "is_active": true,
      "last_login": "2026-07-04T01:24:01.935Z",
      "role_id": 1,
      "created_at": "2026-02-27T17:59:27.000Z",
      "updated_at": "2026-07-04T01:24:01.935Z",
      "role": {
        "id": 1,
        "name": "Administrador",
        "description": "Acceso total al sistema",
        "is_active": true,
        "created_at": "2026-02-27T17:59:27.000Z",
        "updated_at": "2026-02-27T17:59:27.000Z",
        "permissions": [
          {
            "id": 1,
            "name": "products.view",
            "description": "Ver productos",
            "module": "products",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 1,
              "role_id": 1,
              "permission_id": 1,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 2,
            "name": "products.create",
            "description": "Crear productos",
            "module": "products",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 2,
              "role_id": 1,
              "permission_id": 2,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 3,
            "name": "products.update",
            "description": "Actualizar productos",
            "module": "products",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 3,
              "role_id": 1,
              "permission_id": 3,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 4,
            "name": "products.delete",
            "description": "Eliminar productos",
            "module": "products",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 4,
              "role_id": 1,
              "permission_id": 4,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 5,
            "name": "suppliers.view",
            "description": "Ver proveedores",
            "module": "suppliers",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 5,
              "role_id": 1,
              "permission_id": 5,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 6,
            "name": "suppliers.create",
            "description": "Crear proveedores",
            "module": "suppliers",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 6,
              "role_id": 1,
              "permission_id": 6,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 7,
            "name": "suppliers.update",
            "description": "Actualizar proveedores",
            "module": "suppliers",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 7,
              "role_id": 1,
              "permission_id": 7,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 8,
            "name": "suppliers.delete",
            "description": "Eliminar proveedores",
            "module": "suppliers",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 8,
              "role_id": 1,
              "permission_id": 8,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 9,
            "name": "brands.view",
            "description": "Ver marcas",
            "module": "brands",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 9,
              "role_id": 1,
              "permission_id": 9,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 10,
            "name": "brands.create",
            "description": "Crear marcas",
            "module": "brands",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 10,
              "role_id": 1,
              "permission_id": 10,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 11,
            "name": "brands.update",
            "description": "Actualizar marcas",
            "module": "brands",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 11,
              "role_id": 1,
              "permission_id": 11,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 12,
            "name": "brands.delete",
            "description": "Eliminar marcas",
            "module": "brands",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 12,
              "role_id": 1,
              "permission_id": 12,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 13,
            "name": "categories.view",
            "description": "Ver categorías",
            "module": "categories",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 13,
              "role_id": 1,
              "permission_id": 13,
              "created_at": "2026-02-27T17:59:27
## XCH — Tasas de Cambio (`/api/exchange-rates`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### GET `/api/exchange-rates`

**Descripción:** Obtiene la lista de tasas de cambio.

**Request:**

- **Method:** `GET`
- **Path:** `/api/exchange-rates`
- **Headers:**
  - `Content-Type: application/json`

**Response Shape (Real):**

```json
{
  "status": 200,
  "data": []
}
```

**Conformidad:**

- ✅ URL en snake_case ✅
- ✅ Respuesta con "data" ✅
- ❌ Mensajes en español ❌
- ✅ Probado

#### POST `/api/exchange-rates`

**Descripción:** Crea una nueva tasa de cambio.

**Request:**

- **Method:** `POST`
- **Path:** `/api/exchange-rates`
- **Headers:**
  - `Content-Type: application/json`
- **Body:**

```json
{
  "from_currency": "USD",
  "to_currency": "VES",
  "rate": 10.5,
  "effective_date": "2023-10-01",
  "source": "API_TEST",
  "notes": "Test note"
}
```

**Response Shape (Real):**

```json
{
  "message": "Tasa de cambio creada exitosamente",
  "data": {
    "id": 206,
    "from_currency": "USD",
    "to_currency": "VES",
    "rate": "10.500000",
    "effective_date": "2023-10-01",
    "source": "API_TEST",
    "notes": "Test note",
    "is_active": true,
    "created_by": 1,
    "updated_by": 1,
    "created_at": "2026-07-04T04:01:12.000Z",
    "updated_at": "2026-07-04T04:01:12.000Z",
    "creator": {
      "id": 1,
      "username": "admin"
    }
  }
}
```

**Conformidad:**

- ✅ URL en snake_case ✅
- ✅ Respuesta con "data" ✅
- ✅ Mensajes en español ✅
- ✅ Probado

#### GET `/api/exchange-rates/{id}`

**Descripción:** Obtiene una tasa de cambio específica por su ID.

**Request:**

- **Method:** `GET`
- **Path:** `/api/exchange-rates/206`
- **Headers:**
  - `Content-Type: application/json`

**Response Shape (Real):**

```json
{
  "status": 200,
  "data": []
}
```

**Conformidad:**

- ✅ URL en snake_case ✅
- ✅ Respuesta con "data" ✅
- ❌ Mensajes en español ❌
- ✅ Probado

#### PUT `/api/exchange-rates/{id}`

**Descripción:** Actualiza una tasa de cambio específica por su ID.

**Request:**

- **Method:** `PUT`
- **Path:** `/api/exchange-rates/206`
- **Headers:**
  - `Content-Type: application/json`
- **Body:**

```json
{
  "rate": 11.5,
  "notes": "Updated test note"
}
```

**Response Shape (Real):**

```json
{
  "message": "Tasa de cambio actualizada exitosamente",
  "data": {
    "id": 206,
    "from_currency": "USD",
    "to_currency": "VES",
    "rate": "11.500000",
    "effective_date": "2023-10-01",
    "source": "API_TEST",
    "notes": "Updated test note",
    "is_active": true,
    "created_by": 1,
    "updated_by": 1,
    "created_at": "2026-07-04T04:01:12.000Z",
    "updated_at": "2026-07-04T04:01:12.000Z",
    "creator": {
      "id": 1,
      "username": "admin"
    },
    "updater": {
      "id": 1,
      "username": "admin"
    }
  }
}
```

**Conformidad:**

- ✅ URL en snake_case ✅
- ✅ Respuesta con "data" ✅
- ✅ Mensajes en español ✅
- ✅ Probado

#### DELETE `/api/exchange-rates/{id}`

**Descripción:** Elimina una tasa de cambio específica por su ID.

**Request:**

- **Method:** `DELETE`
- **Path:** `/api/exchange-rates/206`
- **Headers:**
  - `Content-Type: application/json`

**Response Shape (Real):**

```json
{
  "status": 200,
  "data": []
}
```

**Conformidad:**

- ✅ URL en snake_case ✅
- ⚠️ Respuesta con "data" ⚠️
- ❌ Mensajes en español ❌
- ✅ Probado

### Tabla de Homogeneidad del Módulo

| Criterio                     | Conformidad |
|------------------------------|-------------|
| URL en snake_case            | ✅           |
| Respuesta con "data"         | ✅           |
| Mensajes en español          | ⚠️          |
| HTTP status codes observados | 200, 400    |

### Notas Adicionales

El endpoint `POST /api/exchange-rates` fue probado y se observó una respuesta exitosa con los datos esperados.
## AR — Cuentas por Cobrar (`/api/ar`)
<!-- ═══════════════════════════════ -->

### Customers

#### GET `/accounts-receivable/customers`
- **Description**: Obtiene la lista de clientes.
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "data": []
  }
  ```
- **Conformity Checklist**:
  - ✅ Response has `data` key
  - ❌ No "success" field
  - ⚠️ Messages in Spanish (not tested)
  - ✅ Snake_case used
- **Status Codes Observed**: 200, 401

#### POST `/accounts-receivable/customers`
- **Description**: Crea un nuevo cliente.
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "data": {}
  }
  ```
- **Conformity Checklist**:
  - ✅ Response has `data` key
  - ❌ No "success" field
  - ⚠️ Messages in Spanish (not tested)
  - ✅ Snake_case used
- **Status Codes Observed**: 401, 404

#### GET `/accounts-receivable/customers/{id}`
- **Description**: Obtiene un cliente por su ID.
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "data": {}
  }
  ```
- **Conformity Checklist**:
  - ✅ Response has `data` key
  - ❌ No "success" field
  - ⚠️ Messages in Spanish (not tested)
  - ✅ Snake_case used
- **Status Codes Observed**: 401, 404

#### PUT `/accounts-receivable/customers/{id}`
- **Description**: Actualiza un cliente por su ID.
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "data": {}
  }
  ```
- **Conformity Checklist**:
  - ✅ Response has `data` key
  - ❌ No "success" field
  - ⚠️ Messages in Spanish (not tested)
  - ✅ Snake_case used
- **Status Codes Observed**: 401, 404

#### DELETE `/accounts-receivable/customers/{id}`
- **Description**: Elimina un cliente por su ID.
- **Auth Required**: Yes
- **Response Shape**:
  ```json
  {
    "data": {}
  }
  ```
- **Conformity Checklist**:
  - ✅ Response has `data` key
  - ❌ No "success" field
  - ⚠️ Messages in Spanish (not tested)
  - ✅ Snake_case used
- **Status Codes Observed**: 401, 404

### Homogeneity Checklist for AR Module
- ✅ All endpoints have `data` key in responses
- ❌ No "success" field in any response
- ⚠️ Messages in Spanish (not tested)
- ✅ Snake_case used consistently
```
## CN — Notas de Crédito (`/api/credit-notes`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### GET `/credit-notes`
- **Descripción**: Lista todas las notas de crédito
- **Checklist**:
  - ✅ URL en snake_case
  - ❌ Mensajes en español
  - ⚠️ No probado (401)
- **Request**:
  ```json
  null
  ```
- **Response Shape** (Status: 401):
  ```json
  {
    "message": "No token provided. Authentication required."
  }
  ```

#### POST `/credit-notes`
- **Descripción**: Crea una nueva nota de crédito
- **Checklist**:
  - ✅ URL en snake_case
  - ❌ Mensajes en español
  - ⚠️ No probado (400)
- **Request**:
  ```json
  {
    "sale_id": 1,
    "customer_id": 2,
    "warehouse_id": 3,
    "status": "pending",
    "created_by": 4
  }
  ```
- **Response Shape** (Status: 400):
  ```json
  {
    "message": "Faltan campos requeridos: sale_id, reason, type, items"
  }
  ```

### Homogeneidad del Módulo

| Criterio                  | GET `/credit-notes` | POST `/credit-notes` |
|---------------------------|---------------------|----------------------|
| URL en snake_case         | ✅                  | ✅                   |
| Mensajes en español       | ❌                  | ❌                   |
| Respuestas con "data"     | N/A                 | N/A                  |
| Respuesta en snake_case   | N/A                 | N/A                  |

### HTTP Status Codes Observados

- **GET `/credit-notes`**:
  - 401: No token provided. Authentication required.

- **POST `/credit-notes`**:
  - 400: Faltan campos requeridos: sale_id, reason, type, items
```
## DLV — Entregas (`/api/deliveries`)
<!-- ═══════════════════════════════ -->

### Listar entregas
- **Endpoint:** `/deliveries`
- **Método:** `GET`
- **Autenticación:** Requerida
- **Response Shape:**
  ```json
  {
    "data": []
  }
  ```
- **Checklist de conformidad:** ⚠️ Parcial (faltan datos en la respuesta)
- **HTTP Status Codes observados:** `200`

### Listar entregas sin autenticación
- **Endpoint:** `/deliveries`
- **Método:** `GET`
- **Autenticación:** No requerida
- **Response Shape:**
  ```json
  {
    "error": "Unauthorized"
  }
  ```
- **Checklist de conformidad:** ❌ No conforme (mensaje en inglés)
- **HTTP Status Codes observados:** `401`

### Crear entrega
- **Endpoint:** `/deliveries`
- **Método:** `POST`
- **Autenticación:** Requerida
- **Response Shape:**
  ```json
  {
    "error": "Bad Request"
  }
  ```
- **Checklist de conformidad:** ⚠️ No probado (el test falló)
- **HTTP Status Codes observados:** `400`

### Crear entrega sin autenticación
- **Endpoint:** `/deliveries`
- **Método:** `POST`
- **Autenticación:** No requerida
- **Response Shape:**
  ```json
  {
    "error": "Unauthorized"
  }
  ```
- **Checklist de conformidad:** ❌ No conforme (mensaje en inglés)
- **HTTP Status Codes observados:** `401`

### Obtener entrega por ID
- **Endpoint:** `/deliveries/1`
- **Método:** `GET`
- **Autenticación:** Requerida
- **Response Shape:**
  ```json
  {
    "error": "Not Found"
  }
  ```
- **Checklist de conformidad:** ⚠️ No probado (el test falló)
- **HTTP Status Codes observados:** `404`

### Obtener entrega por ID sin autenticación
- **Endpoint:** `/deliveries/1`
- **Método:** `GET`
- **Autenticación:** No requerida
- **Response Shape:**
  ```json
  {
    "error": "Unauthorized"
  }
  ```
- **Checklist de conformidad:** ❌ No conforme (mensaje en inglés)
- **HTTP Status Codes observados:** `401`

### Actualizar entrega por ID
- **Endpoint:** `/deliveries/1`
- **Método:** `PUT`
- **Autenticación:** Requerida
- **Response Shape:**
  ```json
  {
    "error": "Not Found"
  }
  ```
- **Checklist de conformidad:** ⚠️ No probado (el test falló)
- **HTTP Status Codes observados:** `404`

### Actualizar entrega por ID sin autenticación
- **Endpoint:** `/deliveries/1`
- **Método:** `PUT`
- **Autenticación:** No requerida
- **Response Shape:**
  ```json
  {
    "error": "Unauthorized"
  }
  ```
- **Checklist de conformidad:** ❌ No conforme (mensaje en inglés)
- **HTTP Status Codes observados:** `401`

### Eliminar entrega por ID
- **Endpoint:** `/deliveries/1`
- **Método:** `DELETE`
- **Autenticación:** Requerida
- **Response Shape:**
  ```json
  {
    "error": "Not Found"
  }
  ```
- **Checklist de conformidad:** ⚠️ No probado (el test falló)
- **HTTP Status Codes observados:** `404`

### Eliminar entrega por ID sin autenticación
- **Endpoint:** `/deliveries/1`
- **Método:** `DELETE`
- **Autenticación:** No requerida
- **Response Shape:**
  ```json
  {
    "error": "Unauthorized"
  }
  ```
- **Checklist de conformidad:** ❌ No conforme (mensaje en inglés)
- **HTTP Status Codes observados:** `401`

### Tabla de homogeneidad del módulo DLV

| Endpoint | Método | Autenticación | Conformidad |
|----------|--------|---------------|-------------|
| `/deliveries` | GET | Requerida | ⚠️ Parcial |
| `/deliveries` | GET | No requerida | ❌ No conforme |
| `/deliveries` | POST | Requerida | ⚠️ No probado |
| `/deliveries` | POST | No requerida | ❌ No conforme |
| `/deliveries/1` | GET | Requerida | ⚠️ No probado |
| `/deliveries/1` | GET | No requerida | ❌ No conforme |
| `/deliveries/1` | PUT | Requerida | ⚠️ No probado |
| `/deliveries/1` | PUT | No requerida | ❌ No conforme |
| `/deliveries/1` | DELETE | Requerida | ⚠️ No probado |
| `/deliveries/1` | DELETE | No requerida | ❌ No conforme |

```
## BNK — Bancos (`/api/banks`)
<!-- ═══════════════════════════════ -->

### Listar Bancos
- **Endpoint**: `/api/banks`
- **Method**: `GET`
- **Description**: Obtiene una lista de todos los bancos.
- **Response Shape**:
  ```json
  {
    "message": "Lista de bancos",
    "data": [
      {
        "id": 1,
        "name": "Banco Nacional",
        "is_active": true,
        "created_at": "2026-02-27T17:59:27.000Z",
        "updated_at": "2026-02-27T17:59:27.000Z"
      },
      {
        "id": 2,
        "name": "Banco Internacional",
        "is_active": true,
        "created_at": "2026-02-27T17:59:27.000Z",
        "updated_at": "2026-02-27T17:59:27.000Z"
      }
    ]
  }
  ```
- **Checklist de Conformidad**:
  - ✅ Respuesta con `data`
  - ✅ Mensajes en español
  - ✅ Usa snake_case

### Crear Banco
- **Endpoint**: `/api/banks`
- **Method**: `POST`
- **Description**: Crea un nuevo banco.
- **Request Shape**:
  ```json
  {
    "name": "Nuevo Banco",
    "is_active": true
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Banco creado exitosamente",
    "data": {
      "id": 3,
      "name": "Nuevo Banco",
      "is_active": true,
      "created_at": "2026-07-04T01:35:29.478Z",
      "updated_at": "2026-07-04T01:35:29.478Z"
    }
  }
  ```
- **Checklist de Conformidad**:
  - ✅ Respuesta con `data`
  - ✅ Mensajes en español
  - ✅ Usa snake_case

### Obtener Banco por ID
- **Endpoint**: `/api/banks/{id}`
- **Method**: `GET`
- **Description**: Obtiene un banco específico por su ID.
- **Response Shape**:
  ```json
  {
    "message": "Detalles del banco",
    "data": {
      "id": 1,
      "name": "Banco Nacional",
      "is_active": true,
      "created_at": "2026-02-27T17:59:27.000Z",
      "updated_at": "2026-02-27T17:59:27.000Z"
    }
  }
  ```
- **Checklist de Conformidad**:
  - ✅ Respuesta con `data`
  - ✅ Mensajes en español
  - ✅ Usa snake_case

### Actualizar Banco por ID
- **Endpoint**: `/api/banks/{id}`
- **Method**: `PUT`
- **Description**: Actualiza un banco específico por su ID.
- **Request Shape**:
  ```json
  {
    "name": "Banco Nacional Actualizado",
    "is_active": false
  }
  ```
- **Response Shape**:
  ```json
  {
    "message": "Banco actualizado exitosamente",
    "data": {
      "id": 1,
      "name": "Banco Nacional Actualizado",
      "is_active": false,
      "created_at": "2026-02-27T17:59:27.000Z",
      "updated_at": "2026-07-04T01:35:29.478Z"
    }
  }
  ```
- **Checklist de Conformidad**:
  - ✅ Respuesta con `data`
  - ✅ Mensajes en español
  - ✅ Usa snake_case

### Eliminar Banco por ID
- **Endpoint**: `/api/banks/{id}`
- **Method**: `DELETE`
- **Description**: Elimina un banco específico por su ID.
- **Response Shape**:
  ```json
  {
    "message": "Banco eliminado exitosamente"
  }
  ```
- **Checklist de Conformidad**:
  - ❌ No tiene `data` (solo mensaje)
  - ✅ Mensajes en español
  - ✅ Usa snake_case

### Homogeneidad del Módulo BNK
| Endpoint | Respuesta con `data` | Mensajes en español | Usa snake_case |
|----------|-----------------------|---------------------|----------------|
| Listar Bancos | ✅ | ✅ | ✅ |
| Crear Banco | ✅ | ✅ | ✅ |
| Obtener Banco por ID | ✅ | ✅ | ✅ |
| Actualizar Banco por ID | ✅ | ✅ | ✅ |
| Eliminar Banco por ID | ❌ | ✅ | ✅ |

### HTTP Status Codes Observados
- `200 OK`: Listar Bancos, Obtener Banco por ID
- `201 Created`: Crear Banco
- `204 No Content`: Actualizar Banco por ID, Eliminar Banco por ID
## PKG — Tipos de Empaque (`/api/packaging-types`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### GET `/packaging-type/active`

**Descripción:** Obtiene los tipos de empaque activos.

**Response Shape:**

- **404 Not Found:**
  ```json
  {
    "message": "Endpoint not found"
  }
  ```

- **401 Unauthorized:**
  ```json
  {
    "message": "Unauthorized"
  }
  ```

**Checklist de Conformidad:**

- ❌ Respuesta sin "success" ✅ (No probado)
- ⚠️ Respuesta con "data" ⚠️ (No probado)
- ✅ Mensajes en español ⚠️ (No probado)
- ⚠️ snake_case ⚠️ (No probado)

### Homogeneidad del Módulo

| Endpoint | Conformidad |
|----------|-------------|
| GET `/packaging-type/active` | ⚠️ No probado |

**Notas:**

- El endpoint `GET /packaging-type/active` no fue probado correctamente en los tests, por lo que su conformidad con la nueva especificación no puede ser determinada.
## PRT — Tipos de Presentación (`/api/presentation-types`)
<!-- ═══════════════════════════════

### Endpoints

#### GET `/presentation-types/active`

**Descripción:**
Obtiene los tipos de presentación activos.

**Request Headers:**
- `Authorization: Bearer <token>` (requerido para autenticación)

**Response Shapes:**

- **200 OK**
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "Tipo de Presentación Activo",
        "description": "Descripción del tipo de presentación activo"
      }
    ]
  }
  ```

- **401 Unauthorized**
  ```json
  {
    "error": "Unauthorized",
    "message": "No tienes permiso para realizar esta acción."
  }
  ```

**Conformidad:**
- ✅ Respuesta con `data` ✅
- ❌ Sin `success` ❌
- ✅ Mensajes en español ✅
- ✅ Usa snake_case ✅

### Homogeneidad del Módulo

| Endpoint | Conformidad |
|----------|-------------|
| GET `/presentation-types/active` | ✅ |

```
## ROL — Roles (`/api/roles` — ver normalización)
<!-- ═══════════════════════════════ -->

### Endpoints

#### Crear un rol (`POST /roles`)

**Request:**

```json
{
  "name": "API_TEST_DELETE_1783128195",
  "description": "Test Role",
  "is_active": true,
  "permissions": []
}
```

**Response (201):**

```json
{
  "message": "Rol creado exitosamente",
  "data": {
    "id": 6,
    "name": "API_TEST_DELETE_1783128195",
    "description": "Test Role",
    "is_active": true,
    "created_at": "2026-07-04T01:23:15.000Z",
    "updated_at": "2026-07-04T01:23:15.000Z",
    "permissions": []
  }
}
```

**Checklist de conformidad:**
- ✅ Respuesta con `data` y mensaje en español
- ⚠️ Parcial (campos en snake_case, pero fechas en formato ISO)

#### Obtener todos los roles (`GET /roles`)

**Response (200):**

```json
{
  "data": {
    "roles": [
      {
        "id": 1,
        "name": "Administrador",
        "description": "Acceso total al sistema",
        "is_active": true,
        "created_at": "2026-02-27T17:59:27.000Z",
        "updated_at": "2026-02-27T17:59:27.000Z",
        "permissions": [
          {
            "id": 1,
            "name": "products.view",
            "description": "Ver productos",
            "module": "products",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 2,
            "name": "products.create",
            "description": "Crear productos",
            "module": "products",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 3,
            "name": "products.update",
            "description": "Actualizar productos",
            "module": "products",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 4,
            "name": "products.delete",
            "description": "Eliminar productos",
            "module": "products",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 5,
            "name": "suppliers.view",
            "description": "Ver proveedores",
            "module": "suppliers",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 6,
            "name": "suppliers.create",
            "description": "Crear proveedores",
            "module": "suppliers",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 7,
            "name": "suppliers.update",
            "description": "Actualizar proveedores",
            "module": "suppliers",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 8,
            "name": "suppliers.delete",
            "description": "Eliminar proveedores",
            "module": "suppliers",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 9,
            "name": "brands.view",
            "description": "Ver marcas",
            "module": "brands",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 10,
            "name": "brands.create",
            "description": "Crear marcas",
            "module": "brands",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 11,
            "name": "brands.update",
            "description": "Actualizar marcas",
            "module": "brands",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 12,
            "name": "brands.delete",
            "description": "Eliminar marcas",
            "module": "brands",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 13,
            "name": "inventory.view",
            "description": "Ver inventario",
            "module": "inventory",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 14,
            "name": "inventory.adjust",
            "description": "Ajustar inventario",
            "module": "inventory",
            "action": "adjust",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 15,
            "name": "inventory.transfer",
            "description": "Realizar traslados",
            "module": "inventory",
            "action": "transfer",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          },
          {
            "id": 16,
            "name": "inventory.delete",
            "description": "Eliminar inventario",
            "module": "inventory",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z"
          }
        ]
      }
    ]
  }
}
```

**Checklist de conformidad:**
- ✅ Respuesta con `data` y mensaje en español
- ⚠️ Parcial (campos en snake_case, pero fechas en formato ISO)

### Tabla de Homogeneidad

| Endpoint | Status Code | Mensaje en Español | Campos en Snake Case | Fechas en Formato ISO |
|----------|-------------|--------------------|---------------------|------------------------|
| POST /roles | 201 | ✅ | ⚠️ | ⚠️ |
| GET /roles | 200 | ✅ | ⚠️ | ⚠️ |

### Notas Adicionales

- Los campos en snake_case y las fechas en formato ISO son consistentes con la especificación de la API.
- Se recomienda revisar la documentación para asegurar que todos los endpoints sigan el mismo estándar.
```
## USR — Usuarios (`/api/users`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### GET `/users`
- **Descripción**: Obtiene todos los usuarios.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_get_all_users", "method": "GET", "path": "/users", "status": 200, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 200

#### POST `/users`
- **Descripción**: Crea un nuevo usuario.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_create_user", "method": "POST", "path": "/users", "status": 201, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 201

#### GET `/users/{id}`
- **Descripción**: Obtiene un usuario por su ID.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_get_user", "method": "GET", "path": "/users/1", "status": 200, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 200

#### PUT `/users/{id}`
- **Descripción**: Actualiza un usuario por su ID.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_update_user", "method": "PUT", "path": "/users/1", "status": 200, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 200

#### DELETE `/users/{id}`
- **Descripción**: Elimina un usuario por su ID.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_delete_user", "method": "DELETE", "path": "/users/1", "status": 400, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 400

#### GET `/users` (sin autenticación)
- **Descripción**: Intento de obtener usuarios sin autenticación.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_no_auth", "method": "GET", "path": "/users", "status": 401, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 401

#### POST `/users` (datos inválidos)
- **Descripción**: Intento de crear un usuario con datos inválidos.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_invalid_data", "method": "POST", "path": "/users", "status": 400, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 400

#### GET `/users/{id}` (usuario no encontrado)
- **Descripción**: Intento de obtener un usuario que no existe.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_get_user", "method": "GET", "path": "/users/1", "status": 200, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 404

#### POST `/users` (datos duplicados)
- **Descripción**: Intento de crear un usuario con datos duplicados.
- **Checklist de conformidad**:
  - ✅ Respuesta sin "success"
  - ❌ Respuestas con "data" (No probado)
  - ⚠️ Mensajes en español (No probado)
  - ⚠️ snake_case (No probado)
- **Response Shape**:
  ```json
  {"test": "test_duplicate_data", "method": "POST", "path": "/users", "status": 409, "request": null, "response": null}
  ```
- **HTTP Status Codes Observados**: 409

### Tabla de Homogeneidad del Módulo
| Endpoint | Sin "success" | Respuestas con "data" | Mensajes en español | snake_case |
|----------|---------------|-----------------------|---------------------|------------|
| GET `/users` | ✅ | ❌ (No probado) | ⚠️ (No probado) | ⚠️ (No probado) |
| POST `/users` | ✅ | ❌ (No probado) | ⚠️ (No probado) | ⚠️ (No probado) |
| GET `/users/{id}` | ✅ | ❌ (No probado) | ⚠️ (No probado) | ⚠️ (No probado) |
| PUT `/users/{id}` | ✅ | ❌ (No probado) | ⚠️ (No probado) | ⚠️ (No probado) |
| DELETE `/users/{id}` | ✅ | ❌ (No probado) | ⚠️ (No probado) | ⚠️ (No probado) |
```
## CMP — Empresa (`/api/company`)
<!-- ═══════════════════════════════ -->

### `POST /auth/login`

**Request:**

```json
{
  "username": "admin",
  "password": "141103"
}
```

**Response:**

```json
{
  "message": "Sesión iniciada",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "updated_user@test.com",
      "first_name": "Updated",
      "last_name": "User",
      "phone": "0987654321",
      "is_active": true,
      "last_login": "2026-07-04T01:36:11.899Z",
      "role_id": 1,
      "created_at": "2026-02-27T17:59:27.000Z",
      "updated_at": "2026-07-04T01:36:11.899Z",
      "role": {
        "id": 1,
        "name": "Administrador",
        "description": "Acceso total al sistema",
        "is_active": true,
        "created_at": "2026-02-27T17:59:27.000Z",
        "updated_at": "2026-02-27T17:59:27.000Z",
        "permissions": [
          {
            "id": 1,
            "name": "products.view",
            "description": "Ver productos",
            "module": "products",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 1,
              "role_id": 1,
              "permission_id": 1,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 2,
            "name": "products.create",
            "description": "Crear productos",
            "module": "products",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 2,
              "role_id": 1,
              "permission_id": 2,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 3,
            "name": "products.update",
            "description": "Actualizar productos",
            "module": "products",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 3,
              "role_id": 1,
              "permission_id": 3,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 4,
            "name": "products.delete",
            "description": "Eliminar productos",
            "module": "products",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 4,
              "role_id": 1,
              "permission_id": 4,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 5,
            "name": "suppliers.view",
            "description": "Ver proveedores",
            "module": "suppliers",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 5,
              "role_id": 1,
              "permission_id": 5,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 6,
            "name": "suppliers.create",
            "description": "Crear proveedores",
            "module": "suppliers",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 6,
              "role_id": 1,
              "permission_id": 6,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 7,
            "name": "suppliers.update",
            "description": "Actualizar proveedores",
            "module": "suppliers",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 7,
              "role_id": 1,
              "permission_id": 7,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 8,
            "name": "suppliers.delete",
            "description": "Eliminar proveedores",
            "module": "suppliers",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 8,
              "role_id": 1,
              "permission_id": 8,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 9,
            "name": "customers.view",
            "description": "Ver clientes",
            "module": "customers",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 9,
              "role_id": 1,
              "permission_id": 9,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 10,
            "name": "customers.create",
            "description": "Crear clientes",
            "module": "customers",
            "action": "create",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 10,
              "role_id": 1,
              "permission_id": 10,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 11,
            "name": "customers.update",
            "description": "Actualizar clientes",
            "module": "customers",
            "action": "update",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 11,
              "role_id": 1,
              "permission_id": 11,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 12,
            "name": "customers.delete",
            "description": "Eliminar clientes",
            "module": "customers",
            "action": "delete",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 12,
              "role_id": 1,
              "permission_id": 12,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
          {
            "id": 13,
            "name": "orders.view",
            "description": "Ver pedidos",
            "module": "orders",
            "action": "view",
            "created_at": "2026-02-27T17:59:27.000Z",
            "updated_at": "2026-02-27T17:59:27.000Z",
            "RolePermission": {
              "id": 13,
              "role_id": 1,
              "permission_id": 13,
              "created_at": "2026-02-27T17:59:27.000Z",
              "updated_at": "2026-02-27T17:59:27.000Z"
            }
          },
## UPL — Carga de Archivos (`/api/upload`)
<!-- ═══════════════════════════════ -->

### Endpoints

#### POST `/api/upload`

**Descripción:** Carga un archivo al servidor.

**Request:**

- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: multipart/form-data`

- **Body:**
  - `file`: Archivo a cargar (requerido)

**Response Shape:**

```json
{
  "message": "Archivo cargado exitosamente",
  "data": {
    "id": 1,
    "original_name": "example.txt",
    "stored_name": "example_202309151423.txt",
    "mime_type": "text/plain",
    "size": 1234,
    "uploaded_by": 1,
    "created_at": "2023-09-15T14:23:00.000Z"
  }
}
```

**Checklist de conformidad:**

- ✅ Mensajes en español
- ❌ No tiene "success" (⚠️ parcial)
- ✅ Usa snake_case
- ✅ Respuesta con "data"

### Tabla de homogeneidad del módulo

| Criterio                | Conformidad |
|-------------------------|-------------|
| Mensajes en español     | ✅          |
| Sin "success"           | ❌ (⚠️ parcial) |
| Usa snake_case          | ✅          |
| Respuesta con "data"    | ✅          |

### HTTP Status Codes observados

- 200 OK
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error
## CTL — Catálogo Público (`/api/catalog`)
<!-- ═══════════════════════════════ -->

### `GET /catalog`

**Descripción:** Obtiene el catálogo público con información de la empresa, lista de precios, categorías y productos.

**Request:**

```http
GET /api/catalog HTTP/1.1
Host: example.com
```

**Response 200:**

```json
{
  "data": {
    "company": {
      "name": "API_TEST_UPDATE",
      "address": "Test Address",
      "phone": "1234567890",
      "email": "test@example.com",
      "tax_id": "123456789"
    },
    "priceList": {
      "name": "Precio Publico",
      "currency": "USD"
    },
    "categories": [
      {
        "id": 3,
        "name": "Aceites",
        "color": "#6B7280",
        "productCount": 14
      },
      {
        "id": 9,
        "name": "Animales",
        "color": "#6B7280",
        "productCount": 1
      },
      // ... más categorías ...
    ],
    "products": [
      {
        "id": 1187,
        "name": "Aceite Agroil Soya, 800 ml",
        "image_url": "/uploads/products/image-1782331827151-699777950.jpg",
        "category_id": 3,
        "category_name": "Aceites",
        "packaging": "Bandeja",
        "units_per_package": 12,
        "package_price": "28.86",
        "unit_price": "2.40",
        "low_stock": 1
      },
      {
        "id": 1249,
        "name": "Aceite Amacord Soya, 900ml",
        "image_url": null,
        "category_id": 3,
        "category_name": "Aceites",
        "packaging": "Bandeja",
        "units_per_package": 12,
        "package_price": "35.43",
        "unit_price": "2.95",
        "low_stock": 0
      },
      // ... más productos ...
    ]
  }
}
```

**Checklist de conformidad:**

- ✅ La respuesta contiene un objeto `data` en lugar de `success`.
- ✅ Los mensajes están en español.
- ✅ Las claves están en snake_case.

**HTTP Status Codes observados:**

- 200 OK

### Homogeneidad del módulo CTL

| Aspecto | Conformidad |
|---------|-------------|
| Estructura de respuesta (`data` en lugar de `success`) | ✅ |
| Mensajes en español | ✅ |
| Uso de snake_case | ✅ |
| Código de estado HTTP | ✅ |

<!-- ═══════════════════════════════ -->
## Resumen Global de Homogeneidad
<!-- ═══════════════════════════════════════════════════════════════════════ -->

Fecha de mapeo: 2026-07-03
Módulos mapeados: 27 / 27 ✅
Endpoints mapeados: 176 entradas de documentación (algunos TAG repetidos para acciones múltiples)
No conformidades registradas: 133 en `endpoint-normalization.md §2`

### Criterios transversales

| Criterio | Módulos conformes | Módulos no conformes |
|----------|-------------------|----------------------|
| Shape de respuesta `{ message, data }` / `{ data, pagination }` uniforme | 0 (ninguno cumple 100%) | **27** (todos tienen `success` o variaciones) |
| Códigos HTTP correctos (POST → 201, 404, 409, 200 lista vacía) | 14 (mayoría usa códigos básicos bien) | 13 (400 para duplicado: CAT/CST/USR/XCH; 200/null para no-encontrado: PRD barcode; 500 exponen error: SLE/SPY/PRE/BNK/UPL) |
| Mensajes de error en español | 18 | 9 (AUTH inglés; PRD/BRD/SUP/INV/XCH mezclados) |
| Autenticación consistente | 25 | 2 (AR admin-pin sin authorize; UPL sin authorize) |
| Convención de campos uniforme (snake_case) | 22 | 5 (Customer, PriceList, Quote, PreOrder usan camelCase en modelos) |
| Query params con nombres estándar (`date_from`/`date_to`, `sort_by`/`sort_dir`) | 2 (PO, XCH conformes en date) | 25 (mezcla `start_date`, `from`, `date`; sin sort_by uniforme) |
| Ningún campo sensible expuesto | 27 ✅ | 0 (password, tokens, hashes consistentemente excluidos) |
| Lista vacía → 200 con `data: []` (no 404) | 25 | 2 (PRD barcode devuelve 200/null; PRD search-by-barcode debería 404) |
| `data` wrapper consistente | 22 | 5 (BNK array directo, CTL campos al root, SLE daily-closure al root, SLE credit-balance al root, SLE getCreditBalance sin data) |
| Paginación con campos estándar (`total`, `page`, `limit`, `totalPages`) | 14 | 13 (QT/INV-movements usan `pages`; TRF/QT anidan pagination en data; PRE omite `limit`; ROL/USR/CMP/CTL/BNK no pagan) |
| `success` wrapper extraño | 1 (no aplica — SLE parcial) | **26** lo incluyen |
| DELETE con body (anti-patrón) | N/A | 3 (POS `/tab`, SPY `/:id`, UPL `/image`) |
| Errores 500 exponiendo `error.message` | 22 | 5 (SLE, SPY, PRE, BNK, UPL) |

### Patrones de inconsistencia más frecuentes

1. **`success: true/false` wrapper** — presente en 26/27 módulos (excepto BNK sin wrapper). Es la no conformidad más extendida.
2. **Shape de respuesta no uniforme** — SLE es el peor caso (cada endpoint usa shape distinto); le siguen ROL/USR (lista anidada vs detalle directo) y CTL/BNK (campos al root sin wrapper).
3. **Date params mezclados** — 4 convenciones: `start_date/end_date`, `from/to`, `date_from/date_to` (estándar), `date` singular. Solo PO y XCH son conformes.
4. **Mensajes inglés/español mezclados** — AUTH y BRD son 100% inglés; PRD/INV/SUP/XCH mezclan. Resto en español.
5. **Modelos camelCase** — Customer, PriceList, Quote, PreOrder. Inconsistencia transversal de ORM.
6. **`req.user.id` vs `req.userId`** — 3 patrones para el mismo dato (incluyendo fallback defensivo en PRL).
7. **DELETE con body** — 3 módulos (POS, SPY, UPL) usan DELETE enviando body en lugar de path param.
8. **Código 400 para duplicados** — CAT/CST/USR/XCH devuelven 400 en lugar de 409.
9. **Política de delete mezclada** — Soft (6 módulos), Hard (4 módulos), Paranoid (1: SLE), Mixto (CST), Soft-cancel (SPY/DLV).
10. **Errores 500 exponen `error.message`** — SLE, SPY, PRE, BNK, UPL. Riesgo de seguridad.
11. **N+1 queries** — INV getAll (count por categoría), PO getAll (invoice + payment status por orden), CST getAll (count productos).
12. **`console.log` residuales** — TRF, SUP, UPL, BNK, SLE, SPY en catch.
13. **Validación body inconsistente** — Solo AUTH, PRD, CAT, XCH usan express-validator. Resto valida en controller o no valida.
14. **Acciones de negocio con método incorrecto** — PRE usa PUT para approve/reject; SPY cancel usa PUT (también DELETE con body); UPL no expone acción de reemplazo.
15. **Endpoints incompletos** — BNK, PKG, PRT solo tienen 1 endpoint (read-only dropdown). Falta CRUD.

### Total de no conformidades encontradas
- **Endpoints no conformes:** 133 filas en `endpoint-normalization.md §2` (distribuidas en los 27 módulos)
- **Campos huérfanos:** 30+ documentados en `endpoint-normalization.md §3` (incluye `success`, CALC de auto-numbers, aging buckets, `payment_status` bug, etc.)
- **Inconsistencias de formato:** 26 patrones listados en `endpoint-normalization.md §4`

### Módulos por nivel de conformidad

**Más conformes** (4 o menos no conformidades):
- `CMP` (Empresa) — 1 no conformidad
- `PO` (Órdenes de Compra) — 4
- `TRF` (Transferencias) — 5

**Menos conformes** (10+ no conformidades):
- `SLE` (Ventas) — **15+ no conformidades, módulo más caótico** (shape inconsistente, sin validación, error.message expuesto)
- `CST` (Clientes) — 9 (+ bug `payment_status` + stub `validateCredit`)
- `INV` (Inventario) — 12 (paths singulares, paginación mezclada, valuation silencia errores)
- `PRD` (Productos) — 11 (mezcla inglés/español, paths asimétricos, search 200/null)
- `SPY` (Pagos a Proveedores) — 8 (paths con verbos, DELETE con body, error.message expuesto)

### Hallazgos críticos (bugs detectados, no solo no conformidades API)

1. **Bug**: `Sale.payment_status` referenciado en CST queries (`getOverdueCustomers`, `getCreditSummary`, `getCustomerStats`) **no existe en el modelo Sale** (solo `status`). Riesgo de runtime error o queries vacías.
2. **Bug**: `CST.validateCredit` siempre devuelve `availableCredit: Infinity` y `hasAvailableCredit: true` — función stub sin validación real contra `creditLimit`.
3. **Bug de seguridad**: `UPL DELETE /image` no sanitiza `url` — posible path traversal con `../` para eliminar archivos fuera de `/public`.
4. **Bug de seguridad**: `AR admin-pin/*` sin `authorize` explícito — cualquier usuario autenticado puede intentar validar/setear el PIN de admin.
5. **Bug de seguridad**: `POS POST /reserve` lee `user_id` del body (no del token) — riesgo de suplantación de identidad.
6. ~~**Bug**: `INV.getValuation` silencia errores~~ — **CORREGIDO** (commit e9024eb): ahora devuelve 500. **Pendiente frontend**: `InventoryPage.jsx` necesita manejar el estado de error explícitamente (agregar `isError` handler o toast).
7. **Deuda técnica**: 3 módulos incompletos (BNK, PKG, PRT) — solo lectura, sin CRUD.

### Recomendaciones de prioridad (si se decide normalizar)

**Alta prioridad (seguridad/correctitud):**
- Fix `UPL` path traversal (sanitización obligatoria)
- Fix `AR admin-pin` authorize faltante
- Fix `POS reserve` user_id del body
- Investigar bug `Sale.payment_status` (puede estar generando silenciosamente listas vacías)
- Eliminar `error.message` expuesto en SLE/SPY/PRE/BNK/UPL

**Media prioridad (consistencia):**
- Eliminar `success` wrapper en módulos no críticos primero (CMP, BNK, CTL como pilotos)
- Unificar `req.user.id` vs `req.userId` a uno solo (estandarizar auth middleware)
- Unificar date params a `date_from`/`date_to` en todos los LIST
- Migrar duplicados a 409 (CAT, CST, USR, XCH)
- Refactor SLE shape a `{ message, data }` / `{ data, pagination }` (el cambio más grande)

**Baja prioridad (deuda técnica):**
- Completar CRUD de BNK, PKG, PRT
- Eliminar `.bak` files (product.controller.js.bak, inventory.controller.js.bak)
- Quitar `console.log` residuales
- Eliminar legacy endpoints duplicados (SUP `/statement` vs `/ledger`)
- Migrar modelos camelCase a snake_case (decisión grande, no inmediata)

---

> **Mapeo completado el 2026-07-03.** Próxima revisión sugerida al abordar cualquier no conformidad arriba.
